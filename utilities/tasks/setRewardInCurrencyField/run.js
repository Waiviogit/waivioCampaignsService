const setRewardInCurrency = require('./setRewardInCurrency');

(async () => {
  await setRewardInCurrency();
  process.exit();
})();
