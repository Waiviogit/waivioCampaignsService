const suspendToExpired = require('./suspendToExpired');

(async () => {
  await suspendToExpired();
  process.exit();
})();
