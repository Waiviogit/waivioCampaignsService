const redisSetter = require('utilities/redis/redisSetter');
const redisGetter = require('utilities/redis/redisGetter');
const { CLAIM_REWARD } = require('constants/ttlData');

const checkAndCreateTTL = async () => {
  const { result, error } = await redisGetter.getTTLData(`expire:${CLAIM_REWARD}`);
  if (result) return;
  if (error) {
    console.error(`Check for rewardsBot TTL failed: ${error.message}`);
    return;
  }
  await redisSetter.saveTTL(`expire:${CLAIM_REWARD}`, 605400, 'data');
};

(async () => {
  await checkAndCreateTTL();
})();
