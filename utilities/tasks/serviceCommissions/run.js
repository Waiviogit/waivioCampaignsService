const fillCommissions = require('./fillCommissions');

(async () => {
  await fillCommissions();
  process.exit();
})();
