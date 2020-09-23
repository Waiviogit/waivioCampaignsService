const {
  recalculateDebt, expireMatchBotRecount, campaignExpiration, revoteOnPost,
  paymentsExpiration, withdrawExpiration, expirePowerDown, suspendedExpiration,
} = require('utilities/operations/expiration');
const sentryHelper = require('utilities/helpers/sentryHelper');
const {
  DEMOPOST, MATCH_BOT_VOTE, DOWNVOTE_ON_REVIEW, RECALCULATION_DEBT, PENDING_TRANSFER,
  SUSPENDED_WARNING, PAYMENT_DEBT, WITHDRAW_TRANSACTION, WITHDRAW_REQUEST, CLAIM_REWARD,
} = require('constants/ttlData');
const redis = require('./redis');

exports.startExpiredListener = () => {
  redis.subscribeCampaignExpired(subscribeCampaignsEx);
  redis.subscribeDemoPostsExpired(subscribeDemoPostsEx);
};

const subscribeCampaignsEx = async (chan, msg) => {
  try {
    const data = msg.split('_');
    switch (data[0]) {
      case 'expire:campaign':
        await campaignExpiration.expireCampaign(msg);
        break;
      case 'expire:assign':
        await campaignExpiration.expireAssinged(msg);
        break;
    }
  } catch (e) {
    sentryHelper.captureException(e);
  }
};

const subscribeDemoPostsEx = async (chan, msg) => {
  try {
    const data = msg.split('|');
    const id = data[1];
    const author = data[1];
    const permlink = data[2];
    switch (data[0]) {
      case `expire:${DEMOPOST}`:
        await paymentsExpiration.expireDemoPost({ author, permlink });
        break;
      case `expire:${MATCH_BOT_VOTE}`:
        await expireMatchBotRecount({
          author, permlink, voter: data[3], percent: data[4],
        });
        break;
      case `expire:${CLAIM_REWARD}`:
        if (process.env.NODE_ENV === 'production') {
          await expirePowerDown();
        }
        break;
      case `expire:${PAYMENT_DEBT}`:
        await suspendedExpiration.expireDebtStatus(id);
        break;
      case `expire:${WITHDRAW_TRANSACTION}`:
        await withdrawExpiration.expireWithdrawTransaction(id);
        break;
      case `expire:${SUSPENDED_WARNING}`:
        const reservationPermlink = data[1];
        const days = data[2];
        await suspendedExpiration.suspendedWarning(reservationPermlink, days);
        break;
      case `expire:${RECALCULATION_DEBT}`:
        await recalculateDebt(author, permlink);
        break;
      case `expire:${WITHDRAW_REQUEST}`:
        await withdrawExpiration.expireWithdrawRequest(id);
        break;
      case `expire:${PENDING_TRANSFER}`:
        await paymentsExpiration.expirePendingTransfer(id);
        break;
      case `expire:${DOWNVOTE_ON_REVIEW}`:
        await revoteOnPost({ author, permlink });
        break;
    }
  } catch (e) {
    sentryHelper.captureException(e);
  }
};
