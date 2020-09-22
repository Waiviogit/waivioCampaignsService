const _ = require('lodash');
const { WITHDRAW_REQUEST } = require('constants/ttlData');
const { withdrawFundsModel } = require('models');
const { getSession, getTransactions } = require('utilities/requests/blocktradesRequests');
const { redisSetter } = require('utilities/redis');

exports.expireWithdrawTransaction = async (_id) => {
  await withdrawFundsModel.updateOne({ _id, status: 'pending' }, { status: 'expired' });
};

exports.expireWithdrawRequest = async (_id) => {
  const { result } = await withdrawFundsModel.findOne({ _id });
  if (!result) return;
  const { result: session } = await getSession({ email: process.env.BLOCKTRADES_EMAIL, password: process.env.BLOCKTRADES_PASSWORD });
  if (!session) return redisSetter.saveTTL(`expire:${WITHDRAW_REQUEST}|${_id}`, 15);

  const { result: transactions } = await getTransactions(session.token);
  if (!transactions) return redisSetter.saveTTL(`expire:${WITHDRAW_REQUEST}|${_id}`, 15);

  const transaction = _.find(transactions, (doc) => doc.outputAddress.toLowerCase() === result.address.toLowerCase());
  if (transaction) {
    return withdrawFundsModel.updateOne({ _id },
      {
        transactionId: transaction.transactionId,
        transactionHash: transaction.outputTransactionHash,
        usdValue: +transaction.inputUsdEquivalent,
        outputAmount: +transaction.outputAmount,
      });
  }
  return redisSetter.saveTTL(`expire:${WITHDRAW_REQUEST}|${_id}`, 15);
};
