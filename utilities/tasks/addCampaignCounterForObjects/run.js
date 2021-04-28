const addCounter = require('./addCounter');

(async () => {
  await addCounter();
  process.exit();
})();
