const { addDetails } = require('./addDetails');

(async () => {
  await addDetails();
  process.exit();
})();
