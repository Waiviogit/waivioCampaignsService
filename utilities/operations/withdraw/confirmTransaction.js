const _ = require('lodash');
const { withdrawFundsModel, paymentHistoryModel } = require('models');
const { guestRequests } = require('utilities/requests');
const { validateTransaction } = require('utilities/helpers/transactionsHelper');
const steemHelper = require('utilities/helpers/steemHelper');
const redisSetter = require('utilities/redis/redisSetter');

module.exports = async (_id, accessToken) => {
  const { result } = await withdrawFundsModel.findOne({ _id });
  if (!result) return { error: { status: 404, message: 'Confirmation record not found' } };
  if (result.status !== 'pending') return { error: { status: 422, message: `Your transaction ${result.status}` } };

  const { result: valid, error } = await validateTransaction({
    onlyValidate: true,
    email: result.email,
    userName: result.account,
    accessToken,
    transactionData: {
      ..._.pick(result, ['address', 'outputCoinType', 'inputCoinType', 'amount']),
    },
  });
  if (error) return { error };
  if (valid) {
    const { data, error: transactionError } = await steemHelper.transfer({
      amount: result.amount,
      from: process.env.WALLET_ACC_NAME,
      activeKey: process.env.WALLET_ACC_KEY,
      to: result.receiver,
      memo: result.memo,
    });
    if (transactionError) return { error: { status: 503, message: 'Something went wrong, please contact us: support@waivio.com' } };
    const { result: updatedWithdraw } = await withdrawFundsModel.updateOne({ _id }, { status: 'success', transactionId: _.get(data, 'id') });
    const paymentData = {
      userName: result.account,
      type: 'demo_user_transfer',
      payable: result.amount,
      sponsor: result.receiver,
      memo: result.memo,
      withdraw: _id,

    };
    await redisSetter.saveTTL(`expire:withdrawRequest|${_id}`, 15);
    await paymentHistoryModel.addPaymentHistory(paymentData);
    await guestRequests.createWithdraw(paymentData);
    return { result: updatedWithdraw };
  }
};
