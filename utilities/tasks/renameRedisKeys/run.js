const renameRedisKeys = require('./renameRedisKeys');

(async () => {
  await renameRedisKeys();
  process.exit();
})();
