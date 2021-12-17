const axiosRetry = require('axios-retry');
const axios = require('axios');

module.exports = async (params) => {
  try {
    const instance = axios.create();

    axiosRetry(instance, {
      retries: 3,
      retryDelay: (retryCount) => retryCount * 100,
      retryCondition: (error) => error.response.status !== 200,
    });
    return await instance.get('https://accounts.hive-engine.com/accountHistory', { params });
  } catch (error) {
    return error;
  }
};
