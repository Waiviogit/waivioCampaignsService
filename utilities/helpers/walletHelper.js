const { internalExchangeModel, currenciesStatiscticModel } = require('models');
const { hiveRequests, currencyRequest } = require('utilities/requests');
const { SAVINGS_TRANSFERS } = require('constants/walletData');
const moment = require('moment');
const _ = require('lodash');

exports.getWalletData = async (name, limit, marker, types, endDate, startDate, tableView) => {
  let result, error;
  const batchSize = 1000;
  let lastId = marker || -1;
  const walletOperations = [];
  const startDateTimestamp = moment.utc(startDate).valueOf();
  const endDateTimestamp = moment.utc(endDate).valueOf();

  do {
    ({ result, error } = await hiveRequests.getAccountHistory(
      name, lastId, lastId === -1 ? batchSize : (lastId < batchSize ? lastId : batchSize),
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
    if (lastId === 1) breakFlag = true;
    if (breakFlag) break;
  } while (walletOperations.length <= limit || batchSize === result.length - 1);
  const hivePriceArr = await this.getHiveCurrencyHistory(walletOperations);

  return formatHiveHistory({
    walletOperations, hivePriceArr, tableView, name,
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

const formatHiveHistory = ({
  walletOperations, hivePriceArr, tableView, name,
}) => _.map(walletOperations, (history) => {
  const omitFromOperation = ['op', 'block', 'op_in_trx', 'trx_in_block', 'virtual_op', 'trx_id'];
  const price = _.find(hivePriceArr, (el) => moment(el.createdAt).isSame(moment(history[1].timestamp), 'day'));
  const operation = {
    type: history[1].op[0],
    timestamp: moment(history[1].timestamp).unix(),
    hiveUSD: parseFloat(_.get(price, 'hive.usd', '0')),
    hbdUSD: parseFloat(_.get(price, 'hive_dollar.usd', '0')),
    operationNum: history[0],
    withdrawDeposit: withdrawDeposit(history[1].op[0], history[1].op[1], name),
    ...history[1].op[1],
  };

  if (tableView && _.includes(SAVINGS_TRANSFERS, operation.type)) omitFromOperation.push('amount');
  return _.omit(operation, omitFromOperation);
});

const withdrawDeposit = (type, op, name) => {
  if (type === 'transfer') {
    return op.to === name ? 'd' : 'w';
  }
  const data = {
    transfer_to_vesting: 'd',
    claim_reward_balance: 'd',
    transfer_to_savings: '',
    transfer_from_savings: '',
    limit_order_cancel: '',
    limit_order_create: '',
    fill_order: '',
    proposal_pay: 'w',
  };
  return data[type];
};
// #TODO add same to guests

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
