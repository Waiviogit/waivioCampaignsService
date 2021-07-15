const schedule = require('node-schedule');
const campaignsHelper = require('utilities/helpers/campaignsHelper');

schedule.scheduleJob('05 17 */1 * *', async () => {
  await campaignsHelper.rewardConvertJob();
});
