const _ = require('lodash');
const { withdrawFundsModel } = require('models');
const { getTransactionData } = require('utilities/requests/blockcypherRequests');

module.exports = async (_id) => {
  const { result: record } = await withdrawFundsModel.findOne({ _id });
  if (!record) return { error: { status: 404, message: 'Withdraw record not found' } };

  if (!record.transactionHash) {
    return {
      result: {
        status: record.status === 'success' ? 'pending' : record.status,
        sendAmount: record.amount,
        receiveAddress: record.address,
      },
    };
  }
  const { result } = await getTransactionData(record.transactionHash, record.outputCoinType);
  if (!result) return { error: { status: 403, message: 'Please try again later' } };

  return {
    result: {
      ...record,
      confirmed: _.get(result, 'confirmed', null),
      received: _.get(result, 'received', null),
    },
  };
};
