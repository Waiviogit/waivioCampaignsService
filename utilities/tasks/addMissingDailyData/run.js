const addMissingDailyData = require('./addMissingDailyData');

(async () => {
  await addMissingDailyData({ from: process.argv[2], to: process.argv[3] });
  process.exit();
})();
