const { fillPaymentBeneficiaries } = require('./fillBeneficiaries');

(async () => {
  await fillPaymentBeneficiaries();
  process.exit();
})();
