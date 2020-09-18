const _ = require('lodash');
const { PaymentHistory } = require('database').models;

exports.fillPaymentBeneficiaries = async () => {
  let result;
  try {
    result = await PaymentHistory.find({ type: { $nin: ['demo_post', 'demo_user_transfer', 'user_to_guest_transfer', 'transfer', 'demo_debt'] } }).lean();
  } catch (error) {
    console.error(error.message);
  }
  for (const history of result) {
    const beneficiaries = [];
    const histories = _.filter(result,
      (obj) => obj.details.reservation_permlink === history.details.reservation_permlink && obj.type === 'beneficiary_fee');
    _.forEach(histories, (beneficiare) => {
      if (beneficiare.userName === 'waivio') beneficiaries.push({ account: beneficiare.userName, weight: 300 });
      else {
        beneficiaries.push(
          {
            account: beneficiare.userName,
            weight: Math.trunc((beneficiare.amount / history.amount) * 10000),
          },
        );
      }
    });
    await PaymentHistory.updateOne({ _id: history._id }, { $set: { 'details.beneficiaries': beneficiaries } });
  }
};
