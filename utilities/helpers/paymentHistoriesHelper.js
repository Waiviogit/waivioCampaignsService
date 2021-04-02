const _ = require('lodash');
const moment = require('moment');
const { PAYMENT_HISTORIES_TYPES, REVIEW_TYPES, TRANSFER_TYPES } = require('constants/constants');
const { FIELDS_NAMES } = require('constants/wobjectsData');
const {
  paymentHistoryModel, userModel, wobjectModel, campaignModel,
} = require('models');
const { processWobjects, getSessionApp } = require('utilities/helpers/wobjectHelper');
const BigNumber = require('bignumber.js');

const withoutWrapPipeline = (data) => {
  const pipeline = [
    { $match: { userName: data.userName, type: { $nin: ['demo_post', 'demo_user_transfer', 'user_to_guest_transfer'] } } },
    { $sort: { createdAt: 1 } },
    { $addFields: { 'details.payableInDollars': { $multiply: ['$amount', '$details.hiveCurrency'] } } },
  ];
  data.type ? pipeline[0].$match.type = data.type : pipeline[0].$match.sponsor = data.sponsor;
  if (data.ids) pipeline[0].$match = { 'details.reservation_permlink': { $in: data.ids }, type: PAYMENT_HISTORIES_TYPES.REFERRAL_SERVER_FEE };
  return pipeline;
};

/*
In this aggregation, we use grouping by permlink, and to display
the correct type of debt and username, we first sort by type (since the review type
alphabetically will be the most recent of all existing ones, and we need it), in the
grouping we pull the field of the last grouping element to get correct data. It is not
entirely correct, because if a new type of debt appears and it is alphabetically older
than the review, then everything will break
 */
const createReportPipeline = (data) => {
  const pipeline = [
    {
      $match: {
        sponsor: data.sponsor,
        type: data.processingFees
          ? { $in: ['review', 'campaign_server_fee', 'referral_server_fee', 'beneficiary_fee', 'index_fee'] }
          : { $in: ['review', 'beneficiary_fee'] },
        $and: [{ createdAt: { $gt: data.startDate } }, { createdAt: { $lt: data.endDate } }],
      },
    },
    { $sort: { type: 1 } },
    {
      $group: {
        _id: '$details.reservation_permlink',
        amount: { $sum: { $sum: ['$amount', { $ifNull: ['$details.votesAmount', 0] }] } },
        type: { $last: '$type' },
        createdAt: { $last: '$createdAt' },
        userName: { $last: '$userName' },
        sponsor: { $last: '$sponsor' },
        details: { $last: '$details' },
      },
    },
    { $sort: { createdAt: 1 } },
    { $addFields: { 'details.payableInDollars': { $multiply: ['$amount', '$details.hiveCurrency'] } } },
  ];
  if (data.objects.length) pipeline[0].$match.$or = [{ 'details.review_object': { $in: data.objects } }, { 'details.main_object': { $in: data.objects } }];
  return pipeline;
};

const withoutWrapperPayables = async ({
  matchData, skip, limit, currency, filterPayable, pipeline,
}) => {
  let histories, user, error;
  let payable = 0, amount = 0;

  if (matchData.userName) ({ user, error } = await userModel.findOne(matchData.userName));
  ({ result: histories, error } = await paymentHistoryModel.aggregate(pipeline(matchData)));
  const oldestNotPayedReview = _.minBy(
    _.filter(histories, (el) => el.payed === false && _.includes(REVIEW_TYPES, el.type)),
    'createdAt',
  );
  const notPayedPeriod = moment.utc().diff(moment.utc(_.get(oldestNotPayedReview, 'createdAt', {})), 'days');

  if (error) return { error: error.message };

  ({ histories, error } = await fillPayments(histories, currency));
  if (error) return { error };
  _.map(histories, (history) => {
    switch (history.type) {
      case 'compensation_fee':
      case 'index_fee':
      case 'beneficiary_fee':
      case 'campaign_server_fee':
      case 'referral_server_fee':
      case 'overpayment_refund':
      case 'review':
        history.balance = new BigNumber(payable).plus(history.amount).toNumber();
        payable = history.balance;
        amount = new BigNumber(amount).plus(history.amount).toNumber();
        break;
      case 'transfer':
      case 'demo_debt':
        history.balance = new BigNumber(payable).minus(history.amount).toNumber();
        payable = history.balance;
        break;
    }
  });
  _.reverse(histories);
  if (filterPayable && amount > filterPayable) {
    ({ histories, amount } = filterByPayable(histories, filterPayable));
  }
  return {
    histories: limit === 0 ? histories : histories.slice(skip, limit + skip),
    payable: _.ceil(payable, 3),
    amount: _.ceil(amount, 3),
    is_demo: user && !!user.auth,
    hasMore: histories.slice(skip, limit + skip).length < histories.length,
    notPayedPeriod: payable > 0 ? notPayedPeriod : 0,
  };
};

const filterByPayable = (histories, amount) => {
  let counter = 0;
  let currentAmount = 0;
  const filtered = [];
  _.reverse(histories);
  while (currentAmount <= amount) {
    if ((currentAmount + histories[counter].amount) > amount) break;
    if (_.includes(['transfer', 'demo_debt'], histories[counter].type)) {
      currentAmount -= histories[counter].amount;
      histories[counter].balance = currentAmount;
    } else {
      currentAmount += histories[counter].amount;
      histories[counter].balance = currentAmount;
    }
    filtered.unshift(histories[counter]);
    counter++;
  }
  return { histories: filtered, amount: currentAmount };
};

const fillPayments = async (histories, currency) => {
  const permlinks = _.concat(_.map(histories, 'details.review_object'), _.map(histories, 'details.main_object'));
  const reviewPermlinks = _.chain(histories).map('details.reservation_permlink').uniq().compact()
    .value();

  let { result: wobjects, error: wobjError } = await wobjectModel.aggregate([
    { $match: { author_permlink: { $in: _.uniq(_.compact(permlinks)) } } },
    { $addFields: { fields: { $filter: { input: '$fields', as: 'field', cond: { $eq: ['$$field.name', 'name'] } } } } },
    {
      $project: {
        _id: 0, author_permlink: 1, fields: 1, object_type: 1, default_name: 1,
      },
    },
  ]);
  if (wobjError) return { error: wobjError };

  const app = await getSessionApp();
  wobjects = await processWobjects({
    fields: [FIELDS_NAMES.NAME],
    wobjects,
    app,
  });

  const { result: payments, error } = await paymentHistoryModel.find({ type: 'review', 'details.reservation_permlink': { $in: reviewPermlinks } });
  if (error) return { error };

  _.forEach(histories, (history) => {
    if (_.includes(['transfer', 'demo_debt', 'overpayment_refund'], history.type)) return;
    const reviewPayment = _.find(payments,
      (payment) => payment.details.reservation_permlink === history.details.reservation_permlink);
    history.currentUser = history.userName;
    history.userName = _.get(reviewPayment, 'userName', null);
    history.details.review_object = _.find(wobjects,
      (wobject) => wobject.author_permlink === history.details.review_object);
    history.details.main_object = _.find(wobjects,
      (wobject) => wobject.author_permlink === history.details.main_object);
    if (currency === 'usd') history.amount = history.details.payableInDollars;
  });
  return { histories };
};

const withWrapperPayables = async ({
  payment_type: paymentType, userName, sponsor, sort, filterDate, filterPayable, skip, limit,
}) => {
  const userKeyName = paymentType === 'payables' ? 'userName' : 'guideName';
  const typeFilter = { $nin: ['demo_post', 'demo_user_transfer', 'user_to_guest_transfer'] };
  const { user, error: userError } = await userModel.findOne(userName);
  if (userError) return { error: userError };

  const project = {
    _id: 0, [userKeyName]: '$_id', payable: 1, alias: 1, lastCreatedAt: 1, payed: 1,
  };
  // eslint-disable-next-line prefer-const
  let { error, result: histories } = await paymentHistoryModel.aggregate([
    { $match: paymentType === 'payables' ? { sponsor, type: typeFilter } : { userName, type: typeFilter } },
    {
      $group: {
        _id: paymentType === 'payables' ? '$userName' : '$sponsor',
        lastCreatedAt: { $max: '$createdAt' },
        payed: { $last: '$payed' },
        reviews: {
          $push: {
            $cond: [
              { $in: ['$type', REVIEW_TYPES] },
              '$$ROOT',
              null,
            ],
          },
        },
        transfers: {
          $push: {
            $cond: [
              { $in: ['$type', TRANSFER_TYPES] },
              '$$ROOT',
              null,
            ],
          },
        },
      },
    },
    {
      $addFields: {
        payable: { $subtract: [{ $sum: '$reviews.amount' }, { $sum: '$transfers.amount' }] },
        lastNotPayedReview: { $arrayElemAt: [{ $filter: { input: '$reviews', as: 'review', cond: { $and: [{ $eq: ['$$review.payed', false] }, { $gte: ['$$review.payable', 0] }] } } }, 0] },
      },
    },
    filterPipe(filterPayable, filterDate),
    { $sort: payablesSort(sort) },
    {
      $lookup: {
        from: 'users', localField: '_id', foreignField: 'name', as: 'user',
      },
    },
    { $addFields: { alias: { $arrayElemAt: ['$user.alias', 0] } } },
    {
      $project: paymentType !== 'payables'
        ? project
        : Object.assign(project, { lastNotPayedReview: 1 }),
    },
  ]);
  if (error) return { error };
  const payable = _.ceil(_.sumBy(histories, 'payable'), 3);

  const result = _.forEach(histories.slice(skip, limit + skip), (history) => {
    history.payable = _.ceil(history.payable, 3);
    if (paymentType === 'payables') {
      history.notPayedPeriod = moment.utc().diff(moment.utc(_.get(history, 'lastNotPayedReview.createdAt', {})), 'days');
      delete history.lastNotPayedReview;
    }
  });
  return {
    payable,
    histories: result,
    is_demo_user: user && !!user.auth,
    hasMore: histories.length > skip + limit,
  };
};

const filterPipe = (payable, date) => {
  const pipe = { $match: {} };
  date ? pipe.$match = { lastCreatedAt: { $lte: date }, payed: false } : null;
  payable ? pipe.$match.payable = { $gte: payable } : null;
  return pipe;
};

const payablesSort = (currentSort) => {
  switch (currentSort) {
    case 'payable': return { payable: -1 };
    case 'date': return { lastCreatedAt: -1 };
    default: return { payable: -1 };
  }
};

const getSingleReport = async ({ guideName, userName, reservationPermlink }) => {
  const { users, error: userError } = await userModel.findByNames([guideName, userName]);
  if (userError) return { error: userError };
  const { result: campaign, error: campaignError } = await campaignModel.findOne({ 'users.permlink': reservationPermlink });
  const { result: histories, error } = await paymentHistoryModel.aggregate([
    { $match: { 'details.reservation_permlink': reservationPermlink } },
    { $addFields: { 'details.payableInDollars': { $multiply: [{ $sum: ['$amount', '$details.votesAmount'] }, '$details.hiveCurrency'] } } },
  ]);
  if (error || campaignError) return { error: (error || campaignError) };

  return { histories, users, campaign };
};

const getReferralPermlinks = async (userName, agent) => {
  const { result: referrals } = await paymentHistoryModel.find({ userName: agent, type: PAYMENT_HISTORIES_TYPES.REFERRAL_SERVER_FEE });

  const { result: reviews } = await paymentHistoryModel.find({
    'details.reservation_permlink': { $in: _.map(referrals, 'details.reservation_permlink') },
    userName,
    type: PAYMENT_HISTORIES_TYPES.REVIEW,
  });
  return _.map(reviews, 'details.reservation_permlink');
};

module.exports = {
  withoutWrapperPayables,
  getReferralPermlinks,
  withoutWrapPipeline,
  createReportPipeline,
  withWrapperPayables,
  getSingleReport,
  fillPayments,
};
