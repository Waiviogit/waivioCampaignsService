const axiosRetry = require('axios-retry');
const axios = require('axios');

module.exports = async (params, skip, limit) => {
  const instance = axios.create();

  const data = {
    symbol: params.symbol,
    account: params.account,
    offset: skip,
    limit,
  };

  axiosRetry(instance, {
    retries: 3,
    retryDelay: (retryCount) => retryCount * 100,
    retryCondition: (error) => error.response.status !== 200,
  });

  return await instance.get('https://accounts.hive-engine.com/accountHistory', { params: data })
    .then((response) => response)
    .catch((error) => error);
};
