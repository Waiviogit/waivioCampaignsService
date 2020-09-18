const _ = require('lodash');
const { paymentHistoryModel } = require('models');

module.exports = async () => {
  const { result } = await paymentHistoryModel.find({ type: { $in: ['review', 'index_fee', 'referral_server_fee', 'campaign_server_fee'] } });
  for (const history of result) {
    if (_.includes(['index_fee', 'referral_server_fee', 'campaign_server_fee'], history.type)) {
      const review = _.find(result,
        (obj) => obj.details.reservation_permlink === history.details.reservation_permlink && obj.type === 'review');
      const commissionPercent = (history.amount / (review.amount + _.get(review, 'details.votesAmount', 0))) * 10000;
      await paymentHistoryModel.updateOne({ _id: history._id }, { $set: { 'details.commissionWeight': commissionPercent } });
    }
  }
};
