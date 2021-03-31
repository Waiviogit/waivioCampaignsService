const { DAYS_TO_PAYABLE_WARNING, REVIEW_TYPES } = require('constants/constants');
const { paymentHistoryModel } = require('models');
const moment = require('moment');
const _ = require('lodash');

module.exports = async ({ userName }) => {
  let warning = false;

  const { result, error } = await paymentHistoryModel.aggregate(getPipeline(userName));
  if (error) return { error };
  for (const el of result) {
    if (!_.has(el, 'lastNotPayedReview')) continue;
    const days = moment.utc().diff(moment.utc(_.get(el, 'lastNotPayedReview.createdAt', {})), 'days');
    if (days > DAYS_TO_PAYABLE_WARNING) {
      warning = true;
      break;
    }
  }
  return { warning };
};

const getPipeline = (sponsor) => [
  {
    $match: {
      sponsor,
      type: { $nin: ['demo_post', 'demo_user_transfer', 'user_to_guest_transfer'] },
    },
  },
  {
    $group: {
      _id: '$userName',
      reviews: {
        $push: {
          $cond: [
            { $in: ['$type', REVIEW_TYPES] },
            '$$ROOT',
            null,
          ],
        },
      },
    },
  },
  {
    $addFields: {
      lastNotPayedReview: { $arrayElemAt: [{ $filter: { input: '$reviews', as: 'review', cond: { $eq: ['$$review.payed', false] } } }, 0] },
    },
  },
  {
    $project: {
      lastNotPayedReview: 1,
    },
  },
];
