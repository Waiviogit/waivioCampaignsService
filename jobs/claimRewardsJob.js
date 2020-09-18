const schedule = require('node-schedule');
const { steemHelper } = require('utilities/helpers');
const { waivioHpowerAcc } = require('constants/constants');


schedule.scheduleJob('0 0 */1 * *', async () => {
  const account = { name: waivioHpowerAcc.userName, key: waivioHpowerAcc.activeKey };
  const { result } = await steemHelper.claimRewards(account);
  if (result) await steemHelper.makeSpecialTransfers(account);
});
