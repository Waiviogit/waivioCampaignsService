const { start } = require('./migrateToNewCampaigns');

(async () => {
  await start(process.argv[2]);
  process.exit();
})();
