const { PAYMENT_HISTORIES_TYPES, HIVE_OPERATIONS_TYPES, SUPPORTED_CURRENCIES } = require('constants/constants');
const { SAVINGS_TRANSFERS, CURRENCIES, ACCOUNT_FILTER_TYPES } = require('constants/walletData');
const { internalExchangeModel, currenciesStatiscticModel, currenciesRateModel } = require('models');
const { hiveRequests, currencyRequest } = require('utilities/requests');
const jsonHelper = require('utilities/helpers/jsonHelper');
const { add } = require('utilities/helpers/calcHelper');
const BigNumber = require('bignumber.js');
const moment = require('moment');
const _ = require('lodash');

exports.getWalletData = async ({
  userName, limit, operationNum, types, endDate, startDate, tableView,
}) => {
  let result, error;
  const batchSize = 1000;
  let lastId = operationNum || -1;
  const walletOperations = [];
  const startDateTimestamp = moment.utc(startDate).valueOf();
  const endDateTimestamp = moment.utc(endDate).valueOf();

  do {
    ({ result, error } = await hiveRequests.getAccountHistory(
      userName, lastId, lastId === -1 ? batchSize : (lastId < batchSize ? lastId : batchSize),
    ));
    let breakFlag = false;
    if (error) return [];
    if (!_.isArray(result)) {
      continue;
    }
    lastId = _.get(result, '[0][0]');
    result = _.reverse(result);

    for (const record of result) {
      if (_.includes(types, _.get(record, '[1].op[0]'))) {
        const recordTimestamp = moment.utc(_.get(record, '[1].timestamp')).valueOf();
        const condition = tableView
          ? startDateTimestamp >= recordTimestamp || walletOperations.length === limit
          : walletOperations.length === limit;
        if (condition) {
          breakFlag = true;
          break;
        }
        if (tableView && endDateTimestamp < recordTimestamp) continue;
        walletOperations.push(record);
      }
    }
    if (lastId === 1 || lastId === 0) breakFlag = true;
    if (breakFlag) break;
  } while (walletOperations.length <= limit || batchSize === result.length - 1);

  return formatHiveHistory({ walletOperations, tableView, userName });
};

/**
 * Get HiveCurrencyHistory according to el dates
 * @param walletOperations {Array}
 * @param path {String} have to be unix timestamp(s)
 * @returns {Promise<*[]>}
 */
exports.getHiveCurrencyHistory = async (walletOperations, path = 'timestamp') => {
  let includeToday = false;
  const orCondition = _
    .chain(walletOperations)
    .map((el) => _.get(el, path, null))
    .uniq()
    .reduce((acc, el) => {
      if (moment.unix(el).isSame(Date.now(), 'day')) includeToday = true;
      acc.push({ createdAt: { $gte: moment.unix(el).startOf('day').format(), $lte: moment.unix(el).endOf('day').format() } });
      return acc;
    }, [])
    .value();
  const { result = [] } = await currenciesStatiscticModel.find({ type: 'dailyData', $or: orCondition });
  if (includeToday) {
    const { usdCurrency, hbdToDollar, error: currencyReqErr } = await currencyRequest.getHiveCurrency(['hive', 'hive_dollar']);
    if (!currencyReqErr) {
      result.push({
        hive: { usd: usdCurrency },
        hive_dollar: { usd: hbdToDollar },
        createdAt: new Date(),
      });
    }
  }

  return result;
};

exports.getCurrencyRates = async ({ wallet, currency }) => {
  if (currency === SUPPORTED_CURRENCIES.USD) return { rates: [] };
  let includeToday = false;
  const dates = _.uniq(_.map(wallet, (record) => {
    if (moment.unix(record.timestamp).isSame(Date.now(), 'day')) includeToday = true;
    return moment.unix(record.timestamp).format('YYYY-MM-DD');
  }));

  const { result = [] } = await currenciesRateModel.find(
    { dateString: { $in: dates }, base: SUPPORTED_CURRENCIES.USD },
    { [`rates.${currency}`]: 1, dateString: 1 },
  );
  if (includeToday) {
    const { result: latest } = await currenciesRateModel.findOne({
      condition: { base: SUPPORTED_CURRENCIES.USD },
      select: { [`rates.${currency}`]: 1 },
      sort: { dateString: -1 },
    });
    if (latest) {
      latest.dateString = moment().format('YYYY-MM-DD');
      result.push(latest);
    }
  }
  return { rates: result };
};

exports.getTransfersHistory = async (hiveHistory) => {
  for (const order of hiveHistory) {
    if (order.type === 'limit_order_cancel') {
      const { result: sameOrders } = await internalExchangeModel.find({ orderId: order.orderid });
      let currentPayOut = 0, openPayOut = 0;
      _.forEach(sameOrders, (obj) => {
        if (obj.type === 'fillOrder') {
          currentPayOut += parseFloat(obj.current_pays);
          openPayOut += parseFloat(obj.open_pays);
        }
      });
      const limitOrder = _.find(sameOrders, (limitOrd) => limitOrd.type === 'limitOrder');
      const currency = limitOrder ? limitOrder.current_pays.split(' ')[1] : 'HIVE';
      const openCurrency = limitOrder ? limitOrder.open_pays.split(' ')[1] : 'HBD';
      order.current_pays = `${currentPayOut ? parseFloat(_.get(limitOrder, 'current_pays', 0)) - currentPayOut : parseFloat(_.get(limitOrder, 'current_pays', 0))} ${currency}`;
      order.open_pays = `${openPayOut ? parseFloat(_.get(limitOrder, 'open_pays', 0)) - openPayOut : parseFloat(_.get(limitOrder, 'open_pays', 0))} ${openCurrency}`;
    }
    switch (order.type) {
      case 'limit_order_cancel':
        order.type = 'cancelOrder';
        break;
      case 'limit_order_create':
        order.type = 'limitOrder';
        order.current_pays = order.amount_to_sell;
        order.open_pays = order.min_to_receive;
        break;
      case 'fill_order':
        order.type = 'fillOrder';
        break;
    }
  }
  return _.orderBy(hiveHistory, ['timestamp', 'type'], ['desc']);
};

exports.withdrawDeposit = ({
  type, record, filterAccounts, userName,
}) => {
  const isMutual = multiAccountFilter({ record, filterAccounts, userName });
  if (isMutual) return '';
  const result = {
    [HIVE_OPERATIONS_TYPES.TRANSFER]: _.get(record, 'to') === userName ? 'd' : 'w',
    [HIVE_OPERATIONS_TYPES.TRANSFER_TO_VESTING]: getPowerDepositWithdraws(record, userName),
    [HIVE_OPERATIONS_TYPES.FILL_VESTING_WITHDRAW]: getPowerDepositWithdraws(record, userName),
    [HIVE_OPERATIONS_TYPES.CLAIM_REWARD_BALANCE]: 'd',
    [HIVE_OPERATIONS_TYPES.PROPOSAL_PAY]: 'w',
    [PAYMENT_HISTORIES_TYPES.DEMO_USER_TRANSFER]: 'w',
    [PAYMENT_HISTORIES_TYPES.USER_TO_GUEST_TRANSFER]: 'd',
    [PAYMENT_HISTORIES_TYPES.DEMO_POST]: 'd',
    [PAYMENT_HISTORIES_TYPES.DEMO_DEBT]: 'd',
  };
  return result[type] || '';
};

const getPowerDepositWithdraws = (op, userName) => {
  if (_.get(op, 'from') === userName && _.get(op, 'to') !== userName) return 'w';
  if (_.get(op, 'from') !== userName && _.get(op, 'to') === userName) return 'd';
  return '';
};

const multiAccountFilter = ({ record, filterAccounts, userName }) => {
  filterAccounts = _.filter(filterAccounts, (el) => el !== userName);

  if (!_.includes(ACCOUNT_FILTER_TYPES, record.type) || _.isEmpty(filterAccounts)) return false;
  switch (record.type) {
    case HIVE_OPERATIONS_TYPES.TRANSFER:
      return filterTypeTransfer({
        memo: jsonHelper.parseJson(record.memo),
        filterAccounts,
        record,
      });
    case HIVE_OPERATIONS_TYPES.TRANSFER_TO_VESTING:
      return filterFromTo(filterAccounts, [record.from, record.to]);
    case HIVE_OPERATIONS_TYPES.FILL_VESTING_WITHDRAW:
      return filterFromTo(filterAccounts, [record.from, record.to]);
    case PAYMENT_HISTORIES_TYPES.USER_TO_GUEST_TRANSFER:
    case PAYMENT_HISTORIES_TYPES.DEMO_USER_TRANSFER:
    case PAYMENT_HISTORIES_TYPES.DEMO_POST:
    case PAYMENT_HISTORIES_TYPES.DEMO_DEBT:
      return _.includes(filterAccounts, _.get(record, 'sponsor'));
    default: return false;
  }
};

const filterTypeTransfer = ({ record, memo, filterAccounts }) => {
  if (record.to === process.env.WALLET_ACC_NAME) {
    return memo.id === PAYMENT_HISTORIES_TYPES.USER_TO_GUEST_TRANSFER
      && _.includes(filterAccounts, memo.to);
  }
  if (record.from === process.env.WALLET_ACC_NAME) {
    return memo.id === 'waivio_guest_transfer' && _.includes(filterAccounts, memo.from);
  }
  return filterFromTo(filterAccounts, [record.to, record.from]);
};

const filterFromTo = (filterAccounts, fromToArr) => (
  _.some(filterAccounts, (el) => _.includes(fromToArr, el)));

const formatHiveHistory = ({ walletOperations, tableView, userName }) => (
  _.map(walletOperations, (history) => {
    const omitFromOperation = [
      'op', 'block', 'op_in_trx', 'trx_in_block', 'virtual_op', 'trx_id', 'deposited', 'from_account', 'to_account',
    ];
    const operation = {
      userName,
      type: history[1].op[0],
      timestamp: moment(history[1].timestamp).unix(),
      operationNum: history[0],
      ...history[1].op[1],
    };
    if (operation.type === HIVE_OPERATIONS_TYPES.FILL_VESTING_WITHDRAW) {
      Object.assign(operation,
        { from: operation.from_account, to: operation.to_account, amount: operation.deposited });
    }
    if (tableView && _.includes(SAVINGS_TRANSFERS, operation.type)) omitFromOperation.push('amount');

    return _.omit(operation, omitFromOperation);
  }));

exports.calcDepositWithdrawals = ({ operations, field }) => _
  .reduce(operations, (acc, el) => {
    if (_.get(el, 'checked')) return acc;
    switch (_.get(el, 'withdrawDeposit')) {
      case 'w':
        acc.withdrawals = add(acc.withdrawals, el[field]);
        break;
      case 'd':
        acc.deposits = add(acc.deposits, el[field]);
        break;
    }
    return acc;
  }, { deposits: 0, withdrawals: 0 });

exports.addCurrencyToOperations = async ({
  walletWithHivePrice, dynamicProperties, currency, rates,
}) => _.map(walletWithHivePrice, (record) => {
  const USD = record.type === HIVE_OPERATIONS_TYPES.CLAIM_REWARD_BALANCE
    ? getPriceFromClaimReward(record, dynamicProperties)
    : getPriceInUSD(record);

  record[currency] = calcWalletRecordRate({
    USD, rates, timestamp: record.timestamp, currency,
  });

  return record;
});

const calcWalletRecordRate = ({
  USD, timestamp, rates, currency,
}) => {
  if (currency === SUPPORTED_CURRENCIES.USD) return USD;
  const dayRateRecord = _.find(rates, (el) => moment.unix(timestamp).isSame(moment(el.dateString), 'day'));
  const rate = _.get(dayRateRecord, `rates.${currency}`, 0);

  return new BigNumber(USD).times(rate).toNumber();
};

const getPriceInUSD = (record) => {
  if (!record.amount) return 0;
  if (record.guest) return new BigNumber(record.amount).times(record.hiveUSD).toNumber();

  const [value, currency] = record.amount.split(' ');
  return new BigNumber(value)
    .times(currency === CURRENCIES.HBD ? record.hbdUSD : record.hiveUSD)
    .toNumber();
};

const getPriceFromClaimReward = (record, dynamicProperties) => {
  let result = 0;
  if (!record.reward_hbd || !record.reward_hive || !record.reward_vests) return result;

  if (parseFloat(record.reward_hbd.split(' ')[0]) !== 0) {
    result = new BigNumber(result)
      .plus(getPriceInUSD({ ...record, amount: record.reward_hbd }))
      .toNumber();
  }
  if (parseFloat(record.reward_hive.split(' ')[0]) !== 0) {
    result = new BigNumber(result)
      .plus(getPriceInUSD({ ...record, amount: record.reward_hive }))
      .toNumber();
  }
  if (parseFloat(record.reward_vests.split(' ')[0]) !== 0) {
    result = new BigNumber(result)
      .plus(getPriceInUSD({
        ...record,
        amount: getHivePowerFromVests(
          parseFloat(record.reward_vests.split(' ')[0]),
          dynamicProperties,
        ),
      }))
      .toNumber();
  }

  return result;
};

const getHivePowerFromVests = (vests, dynamicProperties) => {
  if (!dynamicProperties.total_vesting_fund_hive || !dynamicProperties.total_vesting_shares) return `0.000 ${CURRENCIES.HP}`;
  const totalVestingFundHive = parseFloat(dynamicProperties.total_vesting_fund_hive);
  const totalVestingShares = parseFloat(dynamicProperties.total_vesting_shares);

  const hpAmount = new BigNumber(totalVestingFundHive)
    .times(vests)
    .dividedBy(totalVestingShares)
    .toNumber();
  return `${hpAmount} ${CURRENCIES.HP}`;
};
