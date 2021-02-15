const _ = require('lodash');
const { withdrawFundsModel, paymentHistoryModel } = require('models');
const { guestRequests } = require('utilities/requests');
const { validateTransaction } = require('utilities/helpers/transactionsHelper');
const redisSetter = require('utilities/redis/redisSetter');
const { WITHDRAW_REQUEST } = require('constants/ttlData');
const { hiveClient, hiveOperations } = require('utilities/hiveApi');

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
    const { data, error: transactionError } = await hiveClient.execute(
      hiveOperations.transfer,
      {
        amount: result.amount,
        from: process.env.WALLET_ACC_NAME,
        activeKey: process.env.WALLET_ACC_KEY,
        to: result.receiver,
        memo: result.memo,
      },
    );
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
    await redisSetter.saveTTL(`expire:${WITHDRAW_REQUEST}|${_id}`, 15);
    await paymentHistoryModel.addPaymentHistory(paymentData);
    await guestRequests.createWithdraw(paymentData);
    return { result: updatedWithdraw };
  }
};
