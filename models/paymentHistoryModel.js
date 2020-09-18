const { PaymentHistory } = require('database').models;

const currencyRequest = require('utilities/requests/currencyRequest');

const addPaymentHistory = async ({
  // eslint-disable-next-line camelcase
  type, review_permlink, object_permlink, userReservationPermlink, requiredObject,
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

const aggregate = async (pipeline) => {
  try {
    return { result: await PaymentHistory.aggregate(pipeline) };
  } catch (error) {
    return { error };
  }
};

const find = async (condition, sort = {}) => {
  try {
    return { result: await PaymentHistory.find(condition).sort(sort).lean() };
  } catch (error) {
    return { error };
  }
};

const findOne = async (condition) => {
  try {
    return { result: await PaymentHistory.findOne(condition).lean() };
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
