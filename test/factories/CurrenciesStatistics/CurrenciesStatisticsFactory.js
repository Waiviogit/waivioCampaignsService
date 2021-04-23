const { CurrenciesStatistic } = require('currenciesDB').models;
const moment = require('moment');

const Create = async (data = {}) => {
  const currency = {
    type: data.type || 'dailyData',
    hive: {
      usd: data.hiveUsd || 0,
      usd_24h_change: data.hiveUsd24 || 0,
      btc: data.hiveBtc || 0,
      btc_24h_change: data.hiveBtc24 || 0,
    },
    hive_dollar: {
      usd: data.hbdUsd || 0,
      usd_24h_change: data.hbdUsd24 || 0,
      btc: data.hbdBtc || 0,
      btc_24h_change: data.hbdBtc24 || 0,
    },
    createdAt: data.createdAt || moment.utc(new Date()).set({ hour: 0, minute: 13 }).format(),
  };

  const currencyRecord = new CurrenciesStatistic(currency);

  await currencyRecord.save();
  return currencyRecord.toObject();
};

module.exports = { Create };
