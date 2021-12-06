const axiosRetry = require('axios-retry');
const axios = require('axios');

module.exports = async (params) => {
  axiosRetry(axios, {
    retries: 3,
    retryDelay: (retryCount) => retryCount * 100,
    retryCondition: (error) => error.response.status !== 200,
  });

  const res = await axios.get('https://accounts.hive-engine.com/accountHistory', { params })
    .then((response) => response)
    .catch((error) => error);

  return res;
};
