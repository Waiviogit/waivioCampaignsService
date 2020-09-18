const schedule = require('node-schedule');
const { steemHelper } = require('utilities/helpers');

schedule.scheduleJob('0 0 */1 * *', async () => {
  const account = { name: process.env.POWER_ACC_NAME, key: process.env.POWER_ACC_KEY };
  const { result } = await steemHelper.claimRewards(account);
  if (result) await steemHelper.makeSpecialTransfers(account);
});
