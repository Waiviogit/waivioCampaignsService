const { internalExchangeModel, currenciesStatiscticModel } = require('models');
const { hiveRequests, currencyRequest } = require('utilities/requests');
const { SAVINGS_TRANSFERS, WALLET_TYPES, CURRENCIES } = require('constants/walletData');
const { PAYMENT_HISTORIES_TYPES } = require('constants/constants');
const jsonHelper = require('utilities/helpers/jsonHelper');
const BigNumber = require('bignumber.js');
const moment = require('moment');
const _ = require('lodash');

exports.getWalletData = async ({
  userName, limit, operationNum, types, endDate, startDate, tableView, filterAccounts,
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
        if (tableView && multiAccountFilter({ record: record[1].op, filterAccounts })) continue;
        walletOperations.push(record);
      }
    }
    if (lastId === 1) breakFlag = true;
    if (breakFlag) break;
  } while (walletOperations.length <= limit || batchSize === result.length - 1);
  const hivePriceArr = await this.getHiveCurrencyHistory(walletOperations);

  return formatHiveHistory({
    walletOperations, hivePriceArr, tableView, userName,
  });
};

exports.getHiveCurrencyHistory = async (walletOperations, path = '[1].timestamp') => {
  let includeToday = false;
  const orCondition = _
    .chain(walletOperations)
    .map((el) => _.get(el, path, null))
    .uniq()
    .reduce((acc, el) => {
      if (moment(el).isSame(Date.now(), 'day')) includeToday = true;
      acc.push({ createdAt: { $gte: moment.utc(el).startOf('day').format(), $lte: moment.utc(el).endOf('day').format() } });
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

exports.withdrawDeposit = (type, op, userName) => {
  const result = {
    transfer: _.get(op, 'to') === userName ? 'd' : 'w',
    transfer_to_vesting: 'd',
    claim_reward_balance: 'd',
    transfer_to_savings: '',
    transfer_from_savings: '',
    limit_order_cancel: '',
    limit_order_create: '',
    fill_order: '',
    proposal_pay: 'w',
    demo_user_transfer: 'w',
    user_to_guest_transfer: 'd',
    demo_post: 'd',
    demo_debt: 'd',
  };
  return result[type] || '';
};

const formatHiveHistory = ({
  walletOperations, hivePriceArr, tableView, userName,
}) => _.map(walletOperations, (history) => {
  const omitFromOperation = ['op', 'block', 'op_in_trx', 'trx_in_block', 'virtual_op', 'trx_id'];
  const price = _.find(hivePriceArr, (el) => moment(el.createdAt).isSame(moment(history[1].timestamp), 'day'));
  const operation = {
    type: history[1].op[0],
    timestamp: moment(history[1].timestamp).unix(),
    hiveUSD: parseFloat(_.get(price, 'hive.usd', '0')),
    hbdUSD: parseFloat(_.get(price, 'hive_dollar.usd', '0')),
    operationNum: history[0],
    withdrawDeposit: this.withdrawDeposit(history[1].op[0], history[1].op[1], userName),
    ...history[1].op[1],
  };

  if (tableView && _.includes(SAVINGS_TRANSFERS, operation.type)) omitFromOperation.push('amount');
  return _.omit(operation, omitFromOperation);
});

const multiAccountFilter = ({ record, filterAccounts }) => {
  const [type, operation] = record;
  if (type !== WALLET_TYPES.TRANSFER) return false;

  if (operation.to === process.env.WALLET_ACC_NAME) {
    const memo = jsonHelper.parseJson(operation.memo);
    return memo.id === PAYMENT_HISTORIES_TYPES.USER_TO_GUEST_TRANSFER
      && _.includes(filterAccounts, memo.to);
  }
  return _.includes(filterAccounts, operation.to);
};

exports.calcDepositWithdrawals = (operations, dynamicProperties) => _
  .reduce(operations, (acc, el) => {
    switch (_.get(el, 'withdrawDeposit')) {
      case 'w':
        acc.withdrawals = new BigNumber(acc.withdrawals).plus(getPriceInUSD(el)).toNumber();
        break;
      case 'd':
        acc.deposits = new BigNumber(acc.withdrawals)
          .plus(
            el.type === WALLET_TYPES.CLAIM_REWARD_BALANCE
              ? getPriceFromClaimReward(el, dynamicProperties)
              : getPriceInUSD(el),
          ).toNumber();
        break;
    }
    return acc;
  }, { deposits: 0, withdrawals: 0 });

const getPriceInUSD = (record) => {
  if (!record.amount) return 0;
  const [value, currency] = record.amount.split(' ');
  return new BigNumber(value)
    .times(currency === CURRENCIES.HBD ? record.hbdUSD : record.hiveUSD)
    .toNumber();
};

const getPriceFromClaimReward = async (record, dynamicProperties) => {
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
