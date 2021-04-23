const addSteamToCurrency = require('./addSteemToCurrency');

(async () => {
  await addSteamToCurrency();
  process.exit();
})();
