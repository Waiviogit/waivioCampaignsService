const getDemoDebtHistory = require('utilities/operations/paymentHistory/getDemoDebtHistory');
const { getWalletData, calcDepositWithdrawals } = require('utilities/helpers/walletHelper');
const { redisGetter } = require('utilities/redis');
const _ = require('lodash');
const moment = require('moment');

module.exports = async ({
  accounts, startDate, endDate, types, limit,
}) => {
  accounts = await addWalletDataToAccounts({
    accounts, startDate, endDate, limit, types,
  });

  const usersJointArr = _
    .chain(accounts)
    .reduce((acc, el) => _.concat(acc, el.wallet), [])
    .orderBy(['timestamp'], ['desc'])
    .value();

  const resultArray = _.take(usersJointArr, limit);

  const resAccounts = _.reduce(accounts,
    (acc, el) => (!el.guest
      ? accumulateHiveAcc(resultArray, el, acc)
      : accumulateGuestAcc(resultArray, el, acc)), []);

  const dynamicProperties = await redisGetter.getHashAll('dynamic_global_properties');
  const depositWithdrawals = calcDepositWithdrawals({ operations: resultArray, dynamicProperties });

  return {
    wallet: resultArray,
    accounts: resAccounts,
    hasMore: usersJointArr.length > resultArray.length,
    ...depositWithdrawals,
  };
};

const addWalletDataToAccounts = async ({
  accounts, startDate, endDate, limit, types,
}) => {
  const filterAccounts = _.map(accounts, 'name');
  for (const account of accounts) {
    if (account.guest) {
      const { histories, hasMore } = await getDemoDebtHistory({
        userName: account.name,
        skip: account.skip,
        tableView: true,
        filterAccounts,
        startDate,
        endDate,
        limit,
      });

      _.forEach(histories, (el) => {
        el.timestamp = moment.utc(el.createdAt).valueOf();
        el.guest = true;
      });

      account.wallet = histories;
      account.hasMore = hasMore;
      continue;
    }
    account.wallet = await getWalletData({
      operationNum: account.operationNum,
      userName: account.name,
      limit: limit + 1,
      tableView: true,
      filterAccounts,
      startDate,
      endDate,
      types,
    });
    account.hasMore = account.wallet.length > limit;
  }
  return accounts;
};

const accumulateHiveAcc = (resultArray, account, acc) => {
  const lastOpNum = _.get(_.last(account.wallet), 'operationNum', 1);
  const filterWallet = _.filter(account.wallet,
    (record) => !_.some(resultArray, (result) => _.isEqual(result, record)));
  if (_.isEmpty(filterWallet) && account.hasMore === false) return acc;
  account.operationNum = _.isEmpty(filterWallet)
    ? lastOpNum - 1
    : _.get(filterWallet, '[0].operationNum');
  acc.push(_.omit(account, ['wallet', 'hasMore']));
  return acc;
};

const accumulateGuestAcc = (resultArray, account, acc) => {
  const filterWallet = _.filter(account.wallet,
    (record) => !_.some(resultArray, (result) => _.isEqual(result, record)));
  if (_.isEmpty(filterWallet) && account.hasMore === false) return acc;
  if (account.wallet.length !== filterWallet.length) {
    account.skip += account.wallet.length - filterWallet.length;
  }
  acc.push(_.omit(account, ['wallet', 'hasMore']));
  return acc;
};
