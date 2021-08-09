const schedule = require('node-schedule');
const { hiveOperations } = require('utilities/hiveApi');

schedule.scheduleJob('0 0 */1 * *', async () => {
  const account = { name: process.env.POWER_ACC_NAME, key: process.env.POWER_ACC_KEY };

  const { result } = await hiveOperations.claimRewards(account);
  if (result) await hiveOperations.makeSpecialTransfers(account);
});
