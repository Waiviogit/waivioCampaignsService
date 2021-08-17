const axios = require('axios');

const hiveUrl = 'https://hive-api.arcange.eu';

exports.getTransactionsHistory = async (name) => {
  try {
    const result = await axios.post(hiveUrl, {
      jsonrpc: '2.0',
      method: 'call',
      params: [
        'condenser_api',
        'get_state',
        [`/@${name}/transfers`],
      ],
    });
    return { result: result.data.result };
  } catch (error) {
    return { error };
  }
};

exports.getAccountHistory = async (name, id, limit) => {
  try {
    const result = await axios.post(hiveUrl, {
      jsonrpc: '2.0',
      method: 'call',
      params: [
        'database_api',
        'get_account_history',
        [name, id, limit],
      ],
    });
    return { result: result.data.result };
  } catch (error) {
    return { error };
  }
};
