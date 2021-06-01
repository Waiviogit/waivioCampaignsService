const { getWalletData, calcDepositWithdrawals, addCurrencyToOperations } = require('utilities/helpers/walletHelper');
const getDemoDebtHistory = require('utilities/operations/paymentHistory/getDemoDebtHistory');
const { ADVANCED_WALLET_TYPES } = require('constants/constants');
const { CURRENCIES } = require('constants/walletData');
const { redisGetter } = require('utilities/redis');
const moment = require('moment');
const _ = require('lodash');

module.exports = async ({
  accounts, startDate, endDate, limit, filterAccounts,
}) => {
  const dynamicProperties = await redisGetter.getHashAll('dynamic_global_properties');
  accounts = await addWalletDataToAccounts({
    accounts, startDate, endDate, limit, filterAccounts,
  });

  const usersJointArr = _
    .chain(accounts)
    .reduce((acc, el) => _.concat(acc, el.wallet), [])
    .orderBy(['timestamp'], ['desc'])
    .value();

  const resultArray = addCurrencyToOperations({
    operations: _.take(usersJointArr, limit),
    dynamicProperties,
  });

  const resAccounts = _.reduce(accounts,
    (acc, el) => (!el.guest
      ? accumulateHiveAcc(resultArray, el, acc)
      : accumulateGuestAcc(resultArray, el, acc)), []);

  const depositWithdrawals = calcDepositWithdrawals({
    operations: resultArray,
    field: CURRENCIES.USD,
  });

  const hasMore = usersJointArr.length > resultArray.length
    || _.some(accounts, (acc) => !!acc.hasMore);

  return {
    wallet: resultArray,
    accounts: resAccounts,
    hasMore,
    ...depositWithdrawals,
  };
};

const addWalletDataToAccounts = async ({
  accounts, startDate, endDate, limit, filterAccounts,
}) => Promise.all(accounts.map(async (account) => {
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
      el.timestamp = moment(el.createdAt).unix();
      el.guest = true;
    });

    account.wallet = histories;
    account.hasMore = hasMore;
    return account;
  }
  account.wallet = await getWalletData({
    operationNum: account.operationNum,
    types: ADVANCED_WALLET_TYPES,
    userName: account.name,
    limit: limit + 1,
    tableView: true,
    filterAccounts,
    startDate,
    endDate,
  });
  account.hasMore = account.wallet.length > limit;
  return account;
}));

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
