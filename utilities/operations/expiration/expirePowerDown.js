const _ = require('lodash');
const { CLAIM_REWARD } = require('constants/ttlData');
const { redisSetter } = require('utilities/redis');
const { hiveClient, hiveOperations } = require('utilities/hiveApi');

module.exports = async () => {
  const account = await hiveClient.execute(
    hiveOperations.getAccountInfo,
    process.env.POWER_ACC_NAME,
  );
  const avail = _.round(parseFloat(account.vesting_shares) - parseFloat(account.delegated_vesting_shares), 6) - 0.000001;
  const { props } = await hiveClient.execute(hiveOperations.getCurrentPriceInfo);
  const vestHive = parseFloat(props.total_vesting_fund_steem) * (avail / parseFloat(props.total_vesting_shares));
  if (vestHive <= 0) return redisSetter.saveTTL(`expire:${CLAIM_REWARD}`, 605400, 'data');
  const op = [
    'withdraw_vesting',
    {
      account: account.name,
      vesting_shares: `${avail} VESTS`,
    },
  ];

  await hiveClient.execute(
    hiveOperations.sendOperations,
    { operations: op, key: process.env.POWER_ACC_KEY },
  );
  return redisSetter.saveTTL(`expire:${CLAIM_REWARD}`, 605400, 'data');
};
