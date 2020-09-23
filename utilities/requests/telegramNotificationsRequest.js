const axios = require('axios');
const { telegramApi } = require('constants/appData');

exports.sendSentryNotification = async () => {
  try {
    const result = await axios.post(`${telegramApi.HOST}${telegramApi.BASE_URL}${telegramApi.SENTRY_ERROR}?app=waivioCampaigns`);
    return { result: result.data };
  } catch (error) {
    return { error };
  }
};
