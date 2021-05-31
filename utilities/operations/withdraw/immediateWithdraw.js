const { sendSentryNotification } = require('utilities/requests/telegramNotificationsRequest');
const { withdrawFundsModel, paymentHistoryModel, userModel } = require('models');
const { validateTransaction } = require('utilities/helpers/transactionsHelper');
const { DEFAULT_TRANSACTION_REDIS_TTL_TIME } = require('constants/mailer');
const { hiveClient, hiveOperations } = require('utilities/hiveApi');
const { WITHDRAW_TRANSACTION } = require('constants/ttlData');
const redisSetter = require('utilities/redis/redisSetter');
const { guestRequests } = require('utilities/requests');
const Sentry = require('@sentry/node');
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
    ...transactionData,
  });
  if (createWithdrawErr) return { error: createWithdrawErr };

  await redisSetter.saveTTL(`expire:${WITHDRAW_TRANSACTION}|${withdraw._id}`, DEFAULT_TRANSACTION_REDIS_TTL_TIME);

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
  if (transactionError) {
    Sentry.captureException(transactionError);
    await sendSentryNotification();
    return { error: { status: 503, message: 'Something went wrong, please contact us: support@waivio.com' } };
  }

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

  await paymentHistoryModel.addPaymentHistory(paymentData);
  await guestRequests.createWithdraw(paymentData);

  return { result: !!updatedWithdraw };
};
