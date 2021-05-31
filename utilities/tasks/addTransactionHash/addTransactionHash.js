const { getSession, getTransactions } = require('utilities/requests/blocktradesRequests');
const { WithdrawFunds } = require('database').models;
const _ = require('lodash');

module.exports = async (email, password) => {
  const result = await WithdrawFunds.find({ status: 'success', transactionHash: null }).lean();
  if (!result) return;
  const { result: session } = await getSession({ email, password });
  const { result: transactions } = await getTransactions(session.token);

  for (const record of result) {
    const transaction = _.find(transactions, (doc) => doc.outputAddress.toLowerCase() === record.address.toLowerCase());
    if (transaction && transaction.outputTransactionHash) {
      await WithdrawFunds.updateOne({ _id: record._id }, {
        transactionId: transaction.transactionId,
        transactionHash: transaction.outputTransactionHash,
        usdValue: +transaction.inputUsdEquivalent,
        outputAmount: +transaction.outputAmount,
      });
    }
  }

  console.info('task completed');
};
