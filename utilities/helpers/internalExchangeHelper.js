const _ = require('lodash');
const { orderIds } = require('constants/appData');
const { internalExchangeModel } = require('models');
const { notificationsRequest } = require('utilities/requests');

exports.createExchangeOperation = async ({
  sellString, receiveString, data, type,
}) => {
  const account = _.get(data, 'current_owner', data.owner);
  data[sellString] = transformAmount(data[sellString]);
  data[receiveString] = transformAmount(data[receiveString]);
  data.timestamp = new Date(data.timestamp).valueOf();
  const exchangeModel = {
    type,
    account,
    current_pays: data[sellString],
    open_pays: data[receiveString],
    timestamp: data.timestamp,
    fillOrKill: data.fill_or_kill,
    exchanger: data.open_owner || null,
    orderId: data.current_orderid || data.orderid,
  };
  const { exchange } = await internalExchangeModel.create(exchangeModel);
  if (exchange) console.log('Exchange record successfully create');
  if (type === 'fillOrder' && exchange) {
    await notificationsRequest.custom('fillOrder', exchangeModel);
    const { result } = await internalExchangeModel.findOne(
      { account: data.open_owner, type: 'limitOrder', orderId: data.open_orderid },
    );
    if (!result) return;
    const secondExchangeModel = {
      type,
      account: data.open_owner,
      current_pays: data[receiveString],
      open_pays: data[sellString],
      timestamp: data.timestamp,
      fillOrKill: data.fill_or_kill,
      exchanger: data.current_owner,
      orderId: data.open_orderid,
    };
    const { exchange: exchangerOps } = await internalExchangeModel.create(secondExchangeModel);
    if (exchangerOps) await notificationsRequest.custom('fillOrder', secondExchangeModel);
  }
};

exports.cancelOrder = async ({ owner, orderid, timestamp }) => {
  const { exchange } = await internalExchangeModel.create({
    type: 'cancelOrder',
    account: owner,
    timestamp: new Date(timestamp).valueOf(),
    orderId: orderid,
  });
  if (exchange) console.log('Cancel exchange record successfully create');
};

const transformAmount = (data) => {
  const num = 1;
  return `${data.amount / +num.toPrecision(data.precision + 1 || 4).replace('.', '')} ${orderIds[data.nai]}`;
};
