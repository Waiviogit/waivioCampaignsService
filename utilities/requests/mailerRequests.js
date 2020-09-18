const { mailerApi } = require('constants/appData');
const axios = require('axios');

exports.send = async (data, headers) => {
  try {
    const result = await axios.post(`${mailerApi.HOST}${mailerApi.BASE_URL}${mailerApi.SEND_EMAIL}`, data, { headers });
    return { result: result.data };
  } catch (error) {
    return { error };
  }
};
