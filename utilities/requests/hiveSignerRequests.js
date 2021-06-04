const axios = require('axios');

exports.validateHiveUser = async (token = '', username = '') => {
  try {
    if (!token || token === '') return false;

    const headers = {
      Accept: 'application/json, text/plain, */*',
      'Content-Type': 'application/json',
      Authorization: token,
    };
    const result = await axios.post('https://hivesigner.com/api/me', {}, { headers });
    const { _id } = result.data;

    return username === _id;
  } catch (error) {
    return false;
  }
};
