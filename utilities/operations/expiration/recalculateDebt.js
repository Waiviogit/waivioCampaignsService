const _ = require('lodash');
const { campaignModel, paymentHistoryModel } = require('models');
const mathBotHelper = require('utilities/helpers/matchBotHelper');
const steemHelper = require('utilities/helpers/steemHelper');
const { CAMPAIGN_STATUSES, PAYMENT_HISTORIES_TYPES, TRANSFER_TYPES } = require('constants/constants');

module.exports = async (author, permlink) => {
  const post = await steemHelper.getPostInfo({ author, permlink });
  if (!post.author) return;
  author = mathBotHelper.checkForGuest(author, post.json_metadata);
  const { result: campaign } = await campaignModel.findOne({
    payments: {
      $elemMatch: { status: CAMPAIGN_STATUSES.ACTIVE, userName: author, postPermlink: permlink },
    },
  });
  if (!campaign) return;

  if (parseFloat(post.total_payout_value) + parseFloat(post.curator_payout_value) === 0) {
    return removeVoteDebt(author, permlink, campaign);
  }

  let botUpvotes = 0, elseUpvotes = 0, downvotes = 0;
  for (const vote of post.active_votes) {
    if (+vote.rshares < 0) {
      downvotes += +vote.rshares;
      continue;
    } if (_.includes([...campaign.match_bots, campaign.guideName], vote.voter)) {
      botUpvotes += +vote.rshares;
    } else {
      elseUpvotes += +vote.rshares;
    }
  }
  if (downvotes >= (botUpvotes + elseUpvotes)) return removeVoteDebt(author, permlink, campaign);
  if (downvotes && botUpvotes < (botUpvotes + elseUpvotes) - downvotes) {
    const { currentPrice } = await steemHelper.getCurrentPriceInfo();
    const payout = _.round(((parseFloat(post.total_payout_value)
      + parseFloat(post.curator_payout_value)) / 2) / currentPrice, 3);

    await recountVoteDebt({
      payout, author, permlink, campaign,
    });
  }
};

const recountVoteDebt = async ({
  payout, author, permlink, campaign,
}) => {
  const { histories } = await findHistories({ author, permlink, campaign });
  const voteWeight = _.sumBy(histories, (history) => _.get(history, 'details.votesAmount', 0));
  if (voteWeight === payout) return;

  const compensationFee = _.find(histories,
    (history) => history.type === PAYMENT_HISTORIES_TYPES.COMPENSATION_FEE);
  if (compensationFee) {
    if (compensationFee.payed) {
      const { result: transfer } = await paymentHistoryModel.findOne({
        type: { $in: TRANSFER_TYPES },
        payed: false,
        sponsor: compensationFee.sponsor,
        userName: compensationFee.userName,
      });
      let condition = {
        type: { $in: TRANSFER_TYPES },
        sponsor: compensationFee.sponsor,
        userName: compensationFee.userName,
      };
      if (transfer) condition = { _id: transfer._id };
      await paymentHistoryModel.updateOne(condition, { payed: false, $inc: { 'details.remaining': compensationFee.amount - payout } });
    }
    await paymentHistoryModel.updateOne({ _id: compensationFee._id }, { amount: payout });
  }

  await mathBotHelper.updatePaymentHistories(
    _.filter(histories, (history) => history.type !== 'compensation_fee'),
    voteWeight > payout ? voteWeight - payout : payout - voteWeight,
    voteWeight > payout ? 'subtract' : 'add',
  );
};

const removeVoteDebt = async (author, permlink, campaign) => {
  campaign = campaign.toObject();
  const { histories } = await findHistories({ author, permlink, campaign });
  for (const history of histories) {
    const votesAmount = history.type === PAYMENT_HISTORIES_TYPES.COMPENSATION_FEE
      ? history.amount
      : _.get(history, 'details.votesAmount', 0);

    if (!votesAmount && history.type !== PAYMENT_HISTORIES_TYPES.COMPENSATION_FEE) continue;

    const findCondition = {
      type: { $in: TRANSFER_TYPES }, payed: false, sponsor: campaign.guideName, userName: history.userName,
    };
    const { result } = await paymentHistoryModel.findOne(findCondition);
    const condition = result ? { _id: result._id } : _.omit(findCondition, ['payed']);

    const remaining = _.get(result, 'details.remaining', 0);
    let newRemaining = _.cloneDeep(remaining);
    const newPayedStatus = history.payed && remaining >= votesAmount;
    if (history.payed !== newPayedStatus) newRemaining += history.amount;

    if (history.type === PAYMENT_HISTORIES_TYPES.COMPENSATION_FEE) {
      await paymentHistoryModel.deleteMany({ _id: history._id });
    } else {
      await paymentHistoryModel.updateOne({ _id: history._id }, {
        $inc: { amount: history.details.votesAmount }, 'details.votesAmount': 0, payed: newPayedStatus,
      });
    }

    await paymentHistoryModel.updateOne(condition, {
      payed: result ? votesAmount === remaining : false,
      'details.remaining': votesAmount > remaining ? newRemaining : remaining - votesAmount,
    });
  }
};

const findHistories = async ({ campaign, author, permlink }) => {
  const payment = _.find(campaign.payments, { userName: author, postPermlink: permlink, status: 'active' });

  const user = _.find(campaign.users, (record) => record._id.toString() === payment.reservationId.toString());
  if (!user) return [];

  const { result: histories } = await paymentHistoryModel.find(
    {
      'details.reservation_permlink': user.permlink,
      type: {
        $in: [
          PAYMENT_HISTORIES_TYPES.REVIEW,
          PAYMENT_HISTORIES_TYPES.BENEFICIARY_FEE,
          PAYMENT_HISTORIES_TYPES.COMPENSATION_FEE],
      },
    },
  );
  return { histories: histories || [] };
};
