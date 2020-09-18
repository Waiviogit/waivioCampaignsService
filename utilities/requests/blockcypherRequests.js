const axios = require('axios');

exports.getTransactionData = async (hash, crypto) => {
  try {
    const result = await axios.get(`https://api.blockcypher.com/v1/${crypto}/main/txs/${hash}?limit=50&includeHex=true`);
    if (result.status !== 200) return { error: 'Transaction not found' };
    return { result: result.data };
  } catch (error) {
    return { error };
  }
};
