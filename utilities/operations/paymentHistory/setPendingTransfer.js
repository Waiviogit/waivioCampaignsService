const { PENDING_TRANSFER } = require('constants/ttlData');
const { paymentHistoryModel, userModel } = require('models');
const { redisSetter } = require('utilities/redis');

module.exports = async ({
  userName, sponsor, amount, transactionId, memo,
}) => {
  const { user } = await userModel.findOne(userName);
  if (!user) return { error: { status: 404, message: 'User not found' } };
  const type = user.auth ? 'demo_debt' : 'transfer';
  const { payment, error } = await paymentHistoryModel.addPaymentHistory({
    type, userName, sponsor, transactionId, remaining: 0, payable: amount, memo, permlink: null,
  });
  if (error) return { error: { status: 503, message: error.message } };

  await redisSetter.saveTTL(`expire:${PENDING_TRANSFER}|${payment._id.toString()}`, 60);
  return { result: true };
};
