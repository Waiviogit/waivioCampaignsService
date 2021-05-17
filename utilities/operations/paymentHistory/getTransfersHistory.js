const walletHelper = require('utilities/helpers/walletHelper');
const { INTERNAL_OPERATIONS } = require('constants/constants');
const { redisGetter } = require('utilities/redis');
const _ = require('lodash');

module.exports = async ({
  userName, limit, operationNum, types, endDate, startDate, tableView, filterAccounts,
}) => {
  let depositWithdrawals = {};
  const wallet = await walletHelper.getWalletData({
    userName, limit: limit + 1, operationNum, types, endDate, startDate, tableView, filterAccounts,
  });

  const transfersHistory = _.includes(types, INTERNAL_OPERATIONS)
    ? await walletHelper.getTransfersHistory(wallet)
    : wallet;

  const slicedWallet = _.slice(transfersHistory, 0, limit);

  if (tableView) {
    const dynamicProperties = await redisGetter.getHashAll('dynamic_global_properties');
    depositWithdrawals = walletHelper.calcDepositWithdrawals(slicedWallet, dynamicProperties);
    console.log('kek')
  }

  const lastOperationWithNum = _.findLast(slicedWallet,
    (history) => _.isNumber(history.operationNum));

  return {
    wallet: slicedWallet,
    hasMore: transfersHistory.length > limit,
    operationNum: lastOperationWithNum ? lastOperationWithNum.operationNum - 1 : operationNum,
    ...depositWithdrawals,
  };
};
