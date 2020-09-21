const _ = require('lodash');
const steemHelper = require('utilities/helpers/steemHelper');
const { CLAIM_REWARD } = require('constants/ttlData');
const { redisSetter } = require('utilities/redis');

module.exports = async () => {
  const account = await steemHelper.getAccountInfo(process.env.POWER_ACC_NAME);
  const avail = _.round(parseFloat(account.vesting_shares) - parseFloat(account.delegated_vesting_shares), 6) - 0.000001;
  const { props } = await steemHelper.getCurrentPriceInfo();
  const vestHive = parseFloat(props.total_vesting_fund_steem) * (avail / parseFloat(props.total_vesting_shares));
  if (vestHive <= 0) return redisSetter.saveTTL(`expire:${CLAIM_REWARD}`, 605400, 'data');
  const op = [
    'withdraw_vesting',
    {
      account: account.name,
      vesting_shares: `${avail} VESTS`,
    },
  ];
  await steemHelper.sendOperations(op, process.env.POWER_ACC_KEY);
  return redisSetter.saveTTL(`expire:${CLAIM_REWARD}`, 605400, 'data');
};
