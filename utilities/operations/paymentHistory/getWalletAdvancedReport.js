const {
  addCurrencyToOperations,
  calcDepositWithdrawals,
  getHiveCurrencyHistory,
  withdrawDeposit,
  getWalletData,
} = require('utilities/helpers/walletHelper');
const getDemoDebtHistory = require('utilities/operations/paymentHistory/getDemoDebtHistory');
const { ADVANCED_WALLET_TYPES } = require('constants/constants');
const { CURRENCIES } = require('constants/walletData');
const { walletExemptionsModel } = require('models');
const { redisGetter } = require('utilities/redis');
const moment = require('moment');
const _ = require('lodash');

module.exports = async ({
  accounts, startDate, endDate, limit, filterAccounts, user,
}) => {
  const dynamicProperties = await redisGetter.getHashAll('dynamic_global_properties');
  const exemptions = await getExemptions({ user, accounts });

  accounts = await addWalletDataToAccounts({
    exemptions, filterAccounts, startDate, accounts, endDate, limit,
  });

  const usersJointArr = _
    .chain(accounts)
    .reduce((acc, el) => _.concat(acc, el.wallet), [])
    .orderBy(['timestamp'], ['desc'])
    .value();

  const limitedWallet = _.take(usersJointArr, limit);

  const walletWithHivePrice = await addHivePrice(limitedWallet);
  const resultWallet = addCurrencyToOperations({ walletWithHivePrice, dynamicProperties });

  const resAccounts = _.reduce(accounts,
    (acc, el) => (!el.guest
      ? accumulateHiveAcc(resultWallet, el, acc)
      : accumulateGuestAcc(resultWallet, el, acc)), []);

  const depositWithdrawals = calcDepositWithdrawals({
    operations: resultWallet,
    field: CURRENCIES.USD,
  });

  const hasMore = usersJointArr.length > resultWallet.length
    || _.some(accounts, (acc) => !!acc.hasMore);

  return {
    wallet: resultWallet,
    accounts: resAccounts,
    hasMore,
    ...depositWithdrawals,
  };
};

const addWalletDataToAccounts = async ({
  accounts, startDate, endDate, limit, filterAccounts, exemptions,
}) => Promise.all(accounts.map(async (account) => {
  const filterRecord = _.find(exemptions, (el) => el.userWithExemptions === account.name);
  if (account.guest) {
    const { histories, hasMore } = await getDemoDebtHistory({
      filterOps: _.get(filterRecord, 'exemptions', []),
      userName: account.name,
      skip: account.skip,
      tableView: true,
      filterAccounts,
      startDate,
      endDate,
      limit,
    });

    _.forEach(histories, (el) => {
      el.withdrawDeposit = withdrawDeposit(el.type);
      el.timestamp = moment(el.createdAt).unix();
      el.guest = true;
    });

    account.wallet = histories;
    account.hasMore = hasMore;
    return account;
  }
  account.wallet = await getWalletData({
    filterOps: _.get(filterRecord, 'exemptions', []),
    operationNum: account.operationNum,
    types: ADVANCED_WALLET_TYPES,
    userName: account.name,
    limit: limit + 1,
    tableView: true,
    filterAccounts,
    startDate,
    endDate,
  });
  _.forEach(account.wallet, (el) => {
    el.withdrawDeposit = withdrawDeposit(el.type, el, account.name);
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

const addHivePrice = async (records = []) => {
  if (_.isEmpty(records)) return records;
  const hivePriceArr = await getHiveCurrencyHistory(records, 'timestamp');
  return _.map(records, (record) => {
    const price = _.find(hivePriceArr, (el) => moment(el.createdAt).isSame(moment.unix(record.timestamp), 'day'));
    return {
      ...record,
      hiveUSD: parseFloat(_.get(price, 'hive.usd', '0')),
      hbdUSD: parseFloat(_.get(price, 'hive_dollar.usd', '0')),
    };
  });
};

const getExemptions = async ({ user, accounts }) => {
  let exemptions = [];
  if (user) {
    ({ result: exemptions = [] } = await walletExemptionsModel
      .find({ userName: user, userWithExemptions: { $in: _.map(accounts, 'name') } }));
  }
  return exemptions;
};
