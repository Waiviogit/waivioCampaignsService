const { validateTransaction } = require('utilities/helpers/transactionsHelper');
const { withdrawFundsModel, paymentHistoryModel, userModel } = require('models');
const { hiveClient, hiveOperations } = require('utilities/hiveApi');
const redisSetter = require('utilities/redis/redisSetter');
const { WITHDRAW_REQUEST } = require('constants/ttlData');
const { guestRequests } = require('utilities/requests');
const _ = require('lodash');

module.exports = async ({
  transactionData, userName, accessToken,
}) => {
  const {
    error: validationError, transaction, commission, usdValue,
  } = await validateTransaction({
    transactionData, userName, accessToken, validateEmail: false,
  });

  if (validationError) return { error: validationError };

  const { user } = await userModel.findOne(userName, '+auth');
  if (!user && !user.auth) return { error: { status: 401, message: 'User not found' } };

  const { withdraw, error: createWithdrawErr } = await withdrawFundsModel.create({
    commission,
    memo: transaction.memo,
    receiver: transaction.address,
    usdValue,
    auth: user.auth,
    account: userName,
    ..._.pick(transactionData, ['inputCoinType', 'outputCoinType', 'amount', 'address']),
  });
  if (createWithdrawErr) return { error: createWithdrawErr };

  const { data, error: transactionError } = await hiveClient.execute(
    hiveOperations.transfer,
    {
      amount: withdraw.amount,
      from: process.env.WALLET_ACC_NAME,
      activeKey: process.env.WALLET_ACC_KEY,
      to: withdraw.receiver,
      memo: withdraw.memo,
    },
  );
  if (transactionError) return { error: { status: 503, message: 'Something went wrong, please contact us: support@waivio.com' } };
  const { result: updatedWithdraw } = await withdrawFundsModel
    .updateOne({ _id: withdraw._id }, { status: 'success', transactionId: _.get(data, 'id') });

  const paymentData = {
    userName: withdraw.account,
    type: 'demo_user_transfer',
    payable: withdraw.amount,
    sponsor: withdraw.receiver,
    memo: withdraw.memo,
    withdraw: withdraw._id,
  };

  await redisSetter.saveTTL(`expire:${WITHDRAW_REQUEST}|${withdraw._id}`, 15);
  await paymentHistoryModel.addPaymentHistory(paymentData);
  await guestRequests.createWithdraw(paymentData);

  return { result: !!updatedWithdraw };
};
