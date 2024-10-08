const {
  addCurrencyToOperations,
  calcDepositWithdrawals,
  getHiveCurrencyHistory,
  getCurrencyRates,
  withdrawDeposit,
  getWalletData,
} = require('utilities/helpers/walletHelper');
const getDemoDebtHistory = require('utilities/operations/paymentHistory/getDemoDebtHistory');
const { ADVANCED_WALLET_TYPES } = require('constants/constants');
const { walletExemptionsModel } = require('models');
const { redisGetter } = require('utilities/redis');
const BigNumber = require('bignumber.js');
const moment = require('moment');
const _ = require('lodash');

module.exports = async ({
  accounts, startDate, endDate, limit, filterAccounts, user, currency,
}) => {
  const dynamicProperties = await redisGetter.getHashAll('dynamic_global_properties');

  accounts = await addWalletDataToAccounts({
    filterAccounts, startDate, accounts, endDate, limit,
  });

  const usersJointArr = _
    .chain(accounts)
    .reduce((acc, el) => _.concat(acc, el.wallet), [])
    .orderBy(['timestamp'], ['desc'])
    .value();

  const limitedWallet = _.take(usersJointArr, limit);
  const { rates } = await getCurrencyRates({
    wallet: limitedWallet, currency, pathTimestamp: 'timestamp', momentCallback: moment.unix,
  });

  await getExemptions({ user, wallet: limitedWallet });

  const walletWithHivePrice = await addHivePrice({ wallet: limitedWallet, rates, currency });
  const resultWallet = await addCurrencyToOperations({
    walletWithHivePrice, dynamicProperties, rates, currency,
  });

  const resAccounts = _.reduce(accounts,
    (acc, el) => (!el.guest
      ? accumulateHiveAcc(limitedWallet, el, acc)
      : accumulateGuestAcc(limitedWallet, el, acc)), []);

  const depositWithdrawals = calcDepositWithdrawals({ operations: resultWallet, field: currency });

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
  accounts, startDate, endDate, limit, filterAccounts,
}) => Promise.all(accounts.map(async (account) => {
  if (account.guest) {
    const { histories, hasMore } = await getDemoDebtHistory({
      userName: account.name,
      skip: account.skip,
      tableView: true,
      startDate,
      endDate,
      limit,
    });

    _.forEach(histories, (el) => {
      el.withdrawDeposit = withdrawDeposit({
        type: el.type, record: el, userName: account.name, filterAccounts,
      });
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
    startDate,
    endDate,
  });
  _.forEach(account.wallet, (el) => {
    el.withdrawDeposit = withdrawDeposit({
      type: el.type, record: el, userName: account.name, filterAccounts,
    });
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

const addHivePrice = async ({ wallet, rates, currency }) => {
  if (_.isEmpty(wallet)) return wallet;
  const hivePriceArr = await getHiveCurrencyHistory(wallet, 'timestamp');
  return _.map(wallet, (record) => {
    const price = _.find(hivePriceArr, (el) => moment(el.createdAt).isSame(moment.unix(record.timestamp), 'day'));
    record.hiveUSD = parseFloat(_.get(price, 'hive.usd', '0'));
    record.hbdUSD = parseFloat(_.get(price, 'hive_dollar.usd', '0'));
    if (!_.isEmpty(rates)) {
      const rate = _.find(rates, (el) => moment(el.dateString).isSame(moment.unix(record.timestamp), 'day'));
      record[`hive${currency}`] = new BigNumber(record.hiveUSD).times(_.get(rate, `rates.${currency}`)).toNumber();
      record[`hbd${currency}`] = new BigNumber(record.hbdUSD).times(_.get(rate, `rates.${currency}`)).toNumber();
    }
    return record;
  });
};

/**
 * Method mutate wallet and add checked when record exempted
 * @param user
 * @param wallet
 * @returns {Promise<void>}
 */
const getExemptions = async ({ user, wallet }) => {
  let exemptions = [];
  if (user) {
    const condition = _.reduce(wallet, (acc, record) => {
      const filter = { userName: user, userWithExemptions: record.userName };
      const idFilter = record._id
        ? { recordId: record._id }
        : { operationNum: record.operationNum };

      acc.push({ ...filter, ...idFilter });
      return acc;
    }, []);
    ({ result: exemptions = [] } = await walletExemptionsModel.find({ $or: condition }));
  }
  for (const exemption of exemptions) {
    const record = _.find(wallet, (rec) => (
      _.has(exemption, 'recordId')
        ? _.isEqual(exemption.recordId, rec._id)
        : _.isEqual(exemption.operationNum, rec.operationNum)
    ));
    if (record) record.checked = true;
  }
};
