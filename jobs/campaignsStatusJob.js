const schedule = require('node-schedule');
const { campaignModel } = require('models');

schedule.scheduleJob('0 0 1 * *', async () => {
  const { result } = await campaignModel.updateMany({ status: 'reachedLimit' }, { status: 'active' });
  if (result && result.nModified) {
    console.log(`Successfully return status active for ${result.nModified} reached limit campaigns`);
  }
});
