const {
  recalculateDebt, expireMatchBotRecount, campaignExpiration,
  paymentsExpiration, withdrawExpiration, expirePowerDown, suspendedExpiration,
} = require('utilities/operations/expiration');
const { DEMOPOST, MATCH_BOT_VOTE, DOWNVOTE_ON_REVIEW } = require('constants/ttlData');
const redis = require('./redis');

exports.startExpiredListener = () => {
  redis.subscribeCampaignExpired(subscribeCampaignsEx);
  redis.subscribeDemoPostsExpired(subscribeDemoPostsEx);
};

const subscribeCampaignsEx = async (chan, msg) => {
  const data = msg.split('_');
  switch (data[0]) {
    case 'expire:campaign':
      await campaignExpiration.expireCampaign(msg);
      break;
    case 'expire:assign':
      await campaignExpiration.expireAssinged(msg);
      break;
  }
};

const subscribeDemoPostsEx = async (chan, msg) => {
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
    case 'expire:claimRewardJob':
      if (process.env.NODE_ENV === 'production') {
        await expirePowerDown();
      }
      break;
    case 'expire:paymentDebt':
      await suspendedExpiration.expireDebtStatus(id);
      break;
    case 'expire:withdrawTransaction':
      await withdrawExpiration.expireWithdrawTransaction(id);
      break;
    case 'expire:suspendedWarning':
      const reservationPermlink = data[1];
      const days = data[2];
      await suspendedExpiration.suspendedWarning(reservationPermlink, days);
      break;
    case 'expire:recalculationDebt':
      await recalculateDebt(author, permlink);
      break;
    case 'expire:withdrawRequest':
      await withdrawExpiration.expireWithdrawRequest(id);
      break;
    case 'expire:pendingTransfer':
      await paymentsExpiration.expirePendingTransfer(id);
      break;
    case `expire:${DOWNVOTE_ON_REVIEW}`:
      break;
  }
};
