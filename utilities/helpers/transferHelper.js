const getPayableHistory = require('utilities/operations/paymentHistory/getPayableHistory');
const { MIN_DEBT_TO_SUSPENDED, MIN_TO_PAYED_VALUE } = require('constants/appData');
const { paymentHistoryModel, campaignModel, wobjectModel } = require('models');
const { sumBy, add, subtract } = require('utilities/helpers/calcHelper');
const { CAMPAIGN_STATUSES } = require('constants/constants');
const moment = require('moment');
const config = require('config');
const _ = require('lodash');

/** Private methods */

const checkForUnblockCampaign = async (guideName) => {
  let unblock = true;
  const { result: payments } = await paymentHistoryModel.find(
    {
      sponsor: guideName,
      payed: false,
      type: { $in: ['review', 'beneficiary_fee', 'index_fee', 'campaign_server_fee', 'compensation_fee'] },
      createdAt: { $lte: moment.utc().subtract(30, 'days').toDate() },
    },
    { createdAt: 1 },
  );
  for (const payment of payments) {
    const { result: transfer } = await paymentHistoryModel.findOne({
      type: { $in: ['transfer', 'demo_debt'] },
      sponsor: payment.sponsor,
      userName: payment.userName,
      payed: false,
    });
    if (payment.amount - _.get(transfer, 'details.remaining', 0) > MIN_DEBT_TO_SUSPENDED) {
      unblock = false;
      break;
    }
  }

  if (!unblock) return;
  const { campaigns } = await campaignModel
    .find({ guideName, status: CAMPAIGN_STATUSES.SUSPENDED });
  for (const campaign of campaigns) {
    let status;
    if (campaign.expired_at < new Date()) status = campaign.deactivation_permlink ? 'unassigned' : 'expired';
    else {
      const completedUsers = _.filter(campaign.users, (user) => user.createdAt > moment.utc().startOf('month').toDate());
      if (campaign.activation_permlink) {
        status = campaign.budget - campaign.reward * completedUsers.length > campaign.reward
          ? CAMPAIGN_STATUSES.ACTIVE
          : CAMPAIGN_STATUSES.REACHED_LIMIT;
      } else {
        status = CAMPAIGN_STATUSES.PENDING;
      }
    }
    await campaignModel.updateOne({ _id: campaign._id }, { status });
    await wobjectModel.updateCampaignsCount({
      wobjPermlinks: [campaign.requiredObject, ...campaign.objects],
      status,
      id: campaign._id,
    });
  }
};

/** Public methods */

exports.recountDebtAfterTransfer = async ({
  guideName, userName, amount, isGuest = false,
}) => {
  const { histories } = await getPayableHistory({
    skip: 0, limit: 0, sponsor: guideName, userName,
  });
  _.reverse(histories);

  const suspended = !!await campaignModel.find({ guideName, status: 'suspended' });
  let transferAmount = 0;

  const transferHistories = _.filter(histories,
    (history) => ((isGuest ? history.type === 'demo_debt' : history.type === 'transfer') && !history.payed));
  if (transferHistories.length) {
    await paymentHistoryModel.updateMany(
      { _id: { $in: _.map(transferHistories, '_id') } },
      { payed: true, 'details.remaining': 0 },
    );
    transferAmount = sumBy(transferHistories, (history) => _.get(history, 'details.remaining', 0));
  }

  const debtHistories = _.filter(histories, (history) => !_.includes(['demo_debt', 'transfer'], history.type) && !history.payed);
  amount = add(amount, transferAmount);
  if (!debtHistories.length) return { remaining: _.round(amount, 3), payed: false };

  for (const id in debtHistories) {
    const remaining = debtHistories[id].type === 'overpayment_refund'
      ? debtHistories[id].details.remaining
      : debtHistories[id].amount;

    if (subtract(amount, remaining) < -MIN_TO_PAYED_VALUE && +id === 0) {
      return { remaining: amount, payed: false };
    }

    await paymentHistoryModel.updateOne({ _id: debtHistories[+id]._id },
      _.get(debtHistories[id], 'details.remaining') ? { payed: true } : { payed: true, 'details.remaining': 0 });
    amount = subtract(amount, remaining);

    if (debtHistories[+id + 1]) {
      const nextRemaining = debtHistories[+id + 1].type === 'overpayment_refund'
        ? debtHistories[+id + 1].details.remaining
        : debtHistories[+id + 1].amount;
      if (subtract(amount, nextRemaining) < -MIN_TO_PAYED_VALUE) break;
    }
  }
  if (suspended) await checkForUnblockCampaign(guideName);
  return {
    remaining: amount < 0 ? 0 : _.round(amount, 3),
    payed: amount <= 0 && amount > -MIN_TO_PAYED_VALUE && amount < MIN_TO_PAYED_VALUE,
  };
};

exports.overpaymentRefund = async ({
  memoJson, amount, from, to,
}) => {
  if (memoJson.app && memoJson.app === config.blackListApp) return;

  const { result: lastTransfer } = await paymentHistoryModel.findOne({
    type: { $in: ['demo_debt', 'transfer'] },
    userName: from,
    sponsor: to,
    payed: false,
  });
  const balance = _.round(_.get(lastTransfer, 'details.remaining', 0), 4)
        - amount.match(/.\d*.\d*/)[0];

  if (lastTransfer) {
    await paymentHistoryModel.updateOne({ _id: lastTransfer._id }, {
      payed: balance <= 0,
      'details.remaining': balance <= 0 ? 0 : balance,
    });
  }
  return paymentHistoryModel.addPaymentHistory({
    userName: from,
    remaining: balance <= 0 ? -balance : 0,
    payed: balance >= 0,
    type: 'overpayment_refund',
    payable: amount.match(/.\d*.\d*/)[0],
    sponsor: memoJson.to ? memoJson.to : to,
    memo: memoJson.message,
  });
};
