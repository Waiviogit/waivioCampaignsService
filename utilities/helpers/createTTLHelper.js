const redisSetter = require('utilities/redis/redisSetter');
const redisGetter = require('utilities/redis/redisGetter');

const checkAndCreateTTL = async () => {
  const { result, error } = await redisGetter.getTTLData('expire:claimRewardJob');
  if (result) return;
  if (error) {
    console.error(`Check for rewardsBot TTL failed: ${error.message}`);
    return;
  }
  await redisSetter.saveTTL('expire:claimRewardJob', 605400, 'data');
};

(async () => {
  await checkAndCreateTTL();
})();
