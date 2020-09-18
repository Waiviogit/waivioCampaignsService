const paymentsFix = require('./paymentsFix');

(async () => {
  await paymentsFix();
  process.exit();
})();
