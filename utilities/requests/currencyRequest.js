const axios = require('axios');
const config = require('config');
const _ = require('lodash');

exports.getHiveCurrency = async (ids = ['hive'], currencies = ['usd']) => {
  try {
    const result = await axios
      .get(`${config.waivioUrl}currencies-api/marketInfo?ids=${ids.toString()}&currencies=${currencies.toString()}`);
    return {
      usdCurrency: _.get(result, 'data.current.hive.usd'),
      hbdToDollar: _.get(result, 'data.current.hive_dollar.usd'),
    };
  } catch (error) {
    return getCurrencyFromCoingecko(ids, currencies);
  }
};

const getCurrencyFromCoingecko = async (ids, currencies) => {
  try {
    const result = await axios
      .get(`https://api.coingecko.com/api/v3/simple/price?ids=${ids.toString()}&vs_currencies=${currencies.toString()}`);
    return {
      usdCurrency: _.get(result, 'data.hive.usd'),
      hbdToDollar: _.get(result, 'data.hive_dollar.usd'),
    };
  } catch (error) {
    console.error(error.message);
    return { error };
  }
};
