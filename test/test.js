const { dropDatabase, redis } = require('test/testHelper');

before(async () => {
  process.env.NODE_ENV = 'test';
  await dropDatabase();
  await redis.lastBlockClient.flushdbAsync();
  await redis.campaigns.flushdbAsync();
  await redis.notifications.flushdbAsync();
  await redis.demoPosts.flushdbAsync();
});
