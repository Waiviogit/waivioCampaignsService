const { faker, InternalExchange } = require('test/testHelper');


const Create = async ({
  type, account, exchanger, orderId, currPays, openPays,
} = {}) => {
  const data = {
    type: type || 'fillOrder',
    account: account || faker.name.firstName(),
    orderId: orderId || faker.random.number(),
    timestamp: new Date().valueOf(),
    fillOrKill: false,
    current_pays: currPays || '5 HIVE',
    open_pays: openPays || '1 HBD',
  };

  switch (data.type) {
    case 'fillOrder':
      data.exchanger = exchanger || faker.name.firstName();
      break;
    case 'limitOrder':
      data.exchanger = null;
      break;
  }
  const exchange = new InternalExchange(data);

  await exchange.save();
  return data;
};

module.exports = { Create };
