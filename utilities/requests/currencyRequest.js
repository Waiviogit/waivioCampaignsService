const axios = require('axios');
const config = require('config');
const _ = require('lodash');

exports.getHiveCurrency = async () => {
  try {
    const result = await axios
      .get(`${config.waivioUrl}currencies-api/marketInfo?ids=hive&ids=hive_dollar&currencies=usd`);
    return {
      usdCurrency: _.get(result, 'data.current.hive.usd'),
      hbdToDollar: _.get(result, 'data.current.hive_dollar.usd'),
    };
  } catch (error) {
    return getCurrencyFromCoingecko();
  }
};

const getCurrencyFromCoingecko = async () => {
  try {
    const result = await axios
      .get('https://api.coingecko.com/api/v3/simple/price?ids=hive,hive_dollar&vs_currencies=usd');
    return {
      usdCurrency: _.get(result, 'data.hive.usd'),
      hbdToDollar: _.get(result, 'data.hive_dollar.usd'),
    };
  } catch (error) {
    console.error(error.message);
    return { error };
  }
};
