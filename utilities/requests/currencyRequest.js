const axios = require('axios');
const config = require('config');

exports.getHiveCurrency = async () => {
  try {
    const result = await axios.get(`${config.waivioUrl}currencies-api/marketInfo?ids=hive&currencies=usd`);
    const usdCurrency = result.data.current.hive.usd;
    return { usdCurrency };
  } catch (error) {
    return getCurrencyFromCoingecko();
  }
};

const getCurrencyFromCoingecko = async () => {
  try {
    const result = await axios.get('https://api.coingecko.com/api/v3/simple/price?ids=hive&vs_currencies=usd');
    const usdCurrency = result.data.hive.usd;
    return { usdCurrency };
  } catch (error) {
    // #TODO add event handling if an exception occurs
    console.error(error.message);
    return { error };
  }
};
