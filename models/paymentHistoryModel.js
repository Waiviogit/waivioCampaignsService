const currencyRequest = require('utilities/requests/currencyRequest');
const { PaymentHistory } = require('database').models;
const BigNumber = require('bignumber.js');
const _ = require('lodash');

const addPaymentHistory = async ({
  // eslint-disable-next-line camelcase
  type, review_permlink, object_permlink, userReservationPermlink, requiredObject, post,
  transfer_permlink = null, userName, sponsor, app, payable, hiveCurrency, transactionId,
  owner_account: owner, memo = '', beneficiaries = [], commission, matchBot, payed = false, remaining, withdraw = null,
}) => {
  let details;
  const { usdCurrency } = await currencyRequest.getHiveCurrency();
  if (!hiveCurrency) hiveCurrency = usdCurrency;
  switch (type) {
    case 'compensation_fee':
    case 'campaign_server_fee':
    case 'referral_server_fee':
    case 'index_fee':
    case 'beneficiary_fee':
    case 'review':
      details = {
        beneficiaries,
        review_permlink,
        review_object: object_permlink,
        reservation_permlink: userReservationPermlink,
        main_object: requiredObject,
        hiveCurrency,
        matchBot,
        commissionWeight: commission || null,
      };
      break;
    case 'demo_debt':
    case 'overpayment_refund':
    case 'transfer':
      details = {
        transfer_permlink,
        remaining,
        hiveCurrency,
        payableInDollars: usdCurrency * payable,
      };
      if (transactionId) details.transactionId = transactionId;
      break;
    case 'demo_post':
      details = {
        post_permlink: review_permlink,
        title: post.title,
        post_parent_author: post.parent_author,
        post_parent_permlink: post.parent_permlink,
      };
      break;
  }
  try {
    const payment = await PaymentHistory.create({
      withdraw,
      userName,
      payed,
      sponsor,
      type,
      app,
      details,
      memo,
      amount: payable,
      is_demo_account: !!owner,
    });
    return { result: true, payment };
  } catch (error) {
    return { result: false, error };
  }
};

const updateAmount = async ({
  type, userName, sponsor, amount, reservationPermlink, payed = false, afterVote,
}) => {
  let result;
  const query = { $set: { recounted: true, payed } };

  if (amount) {
    query.$inc = { amount: -amount };
    if (afterVote) query.$inc['details.votesAmount'] = amount;
  }
  try {
    result = await PaymentHistory.updateOne({
      userName,
      sponsor,
      type,
      'details.reservation_permlink': reservationPermlink,
    }, query);
  } catch (error) {
    return false;
  }
  return !!result.n;
};

const parseDecimal = (payment) => {
  for (const paymentKey in _.omit(payment, ['_id'])) {
    if (_.get(payment[paymentKey], '_bsontype') === 'Decimal128') {
      payment[paymentKey] = new BigNumber(payment[paymentKey]).toNumber();
      continue;
    }

    if (typeof payment[paymentKey] === 'object') {
      payment[paymentKey] = parseDecimal(payment[paymentKey]);
    }
  }
  return payment;
};

const aggregate = async (pipeline) => {
  try {
    const payments = await PaymentHistory.aggregate(pipeline);
    return { result: _.map(payments, (payment) => parseDecimal(payment)) };
  } catch (error) {
    return { error };
  }
};

const find = async (condition, sort = {}) => {
  try {
    const payments = await PaymentHistory.find(condition).sort(sort);
    return { result: _.map(payments, (payment) => payment.toJSON()) };
  } catch (error) {
    return { error };
  }
};

const findOne = async (condition) => {
  try {
    const payment = await PaymentHistory.findOne(condition);
    return { result: _.isNil(payment) ? payment : payment.toJSON() };
  } catch (error) {
    return { error };
  }
};

const updateOne = async (condition, updateData) => {
  try {
    return { result: await PaymentHistory.updateOne(condition, updateData) };
  } catch (error) {
    return { error };
  }
};

const deleteMany = async (condition) => {
  try {
    return { result: await PaymentHistory.deleteMany(condition) };
  } catch (error) {
    return { error };
  }
};

const updateMany = async (condition, updateData) => {
  try {
    return { result: await PaymentHistory.updateMany(condition, updateData) };
  } catch (error) {
    return { error };
  }
};

module.exports = {
  updateAmount,
  addPaymentHistory,
  aggregate,
  find,
  updateOne,
  deleteMany,
  findOne,
  updateMany,
};
