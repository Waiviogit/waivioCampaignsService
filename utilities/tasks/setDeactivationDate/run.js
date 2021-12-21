const { setDeactivationDate } = require('./setDeactivationDate');

(async () => {
  await setDeactivationDate();
  process.exit();
})();
