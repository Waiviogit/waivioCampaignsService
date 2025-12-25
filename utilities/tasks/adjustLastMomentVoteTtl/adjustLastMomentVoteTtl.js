const { demoPosts } = require('utilities/redis/redis');
const { LAST_MOMENT_VOTE_KEY } = require('utilities/operations/matchBots/extendedBotHelper');

module.exports = async () => {
  const pattern = `expire:${LAST_MOMENT_VOTE_KEY}*`;
  const keys = await demoPosts.keysAsync(pattern);
  console.log(`found ${keys.length} keys by pattern ${pattern}`);

  for (const key of keys) {
    const ttl = await demoPosts.ttlAsync(key);
    if (ttl === null || ttl <= 0) {
      console.log(`skip ${key}, invalid ttl ${ttl}`);
      continue;
    }
    if (ttl < 60) {
      continue;
    }

    const newTtl = ttl - 40;
    await demoPosts.expireAsync(key, newTtl);
    console.log('reset key', key);
  }

  console.log('task done');
};
