const _ = require('lodash');
const { Campaign, PaymentHistory } = require('database').models;
const { campaignModel } = require('models');
const { redisSetter } = require('utilities/redis');
const notificationsRequest = require('utilities/requests/notificationsRequest');
const { SUSPENDED_WARNING } = require('constants/ttlData');
const { PAYMENT_HISTORIES_TYPES, CAMPAIGN_STATUSES } = require('constants/constants');
const { MIN_DEBT_TO_SUSPENDED } = require('constants/appData');

exports.suspendedWarning = async (permlink, days) => {
  const payments = await PaymentHistory.find({ 'details.reservation_permlink': permlink }).lean();
  const status = _.every(payments, { payed: true });
  if (!status) {
    const review = _.find(payments, (payment) => payment.type === PAYMENT_HISTORIES_TYPES.REVIEW);
    if (!review) return;
    const { result: campaign } = await campaignModel.findOne(
      { guideName: review.sponsor, status: CAMPAIGN_STATUSES.SUSPENDED },
    );
    if (!campaign) {
      const debtsStatuses = [];
      for (const payment of _.filter(payments, { payed: false })) {
        const { paymentsAmount, debtsAmount } = await getPaymentsAmounts(
          payment.sponsor, payment.userName, payment.createdAt,
        );
        debtsStatuses.push(debtsAmount - paymentsAmount < MIN_DEBT_TO_SUSPENDED);
      }
      if (!_.every(debtsStatuses)) {
        await notificationsRequest.custom('suspendedStatus', {
          sponsor: review.sponsor,
          reviewAuthor: review.userName,
          reviewPermlink: review.details.review_permlink,
          days,
        });
      }
    }
    if (+days !== 1) {
      await redisSetter.saveTTL(`expire:${SUSPENDED_WARNING}|${permlink}|1`, 345600);
    }
  }
};

exports.expireDebtStatus = async (id) => {
  const payment = await PaymentHistory.findOne({ _id: id, payed: false }).lean();
  if (!payment) return;
  const { debtsAmount, paymentsAmount } = await getPaymentsAmounts(
    payment.sponsor, payment.userName, payment.createdAt,
  );
  if (debtsAmount - paymentsAmount < MIN_DEBT_TO_SUSPENDED) return;
  await Campaign.updateMany({ guideName: payment.sponsor }, { status: CAMPAIGN_STATUSES.SUSPENDED });
};

const getPaymentsAmounts = async (sponsor, userName, createdAt) => {
  const allPayments = await PaymentHistory.find({
    sponsor, userName, createdAt: { $lte: createdAt }, payed: false,
  });
  const debtsAmount = _.sumBy(allPayments, (pmnt) => {
    if (_.includes(
      [PAYMENT_HISTORIES_TYPES.REVIEW,
        PAYMENT_HISTORIES_TYPES.CAMPAIGNS_SERVER_FEE,
        PAYMENT_HISTORIES_TYPES.REFERRAL_SERVER_FEE,
        PAYMENT_HISTORIES_TYPES.BENEFICIARY_FEE,
        PAYMENT_HISTORIES_TYPES.INDEX_FEE,
        PAYMENT_HISTORIES_TYPES.DEMO_DEBT], pmnt.type,
    )) {
      return pmnt.amount;
    }
  }) || 0;
  const paymentsAmount = _.sumBy(allPayments, (pmnt) => {
    if (_.includes(
      [PAYMENT_HISTORIES_TYPES.TRANSFER], pmnt.type,
    )) {
      return _.get(pmnt, 'details.remaining', 0);
    }
  }) || 0;
  return { debtsAmount, paymentsAmount };
};
