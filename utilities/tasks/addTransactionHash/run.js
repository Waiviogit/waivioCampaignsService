const addTransactionHash = require('./addTransactionHash');

(async () => {
  await addTransactionHash(process.argv[2], process.argv[3]);
  process.exit();
})();
