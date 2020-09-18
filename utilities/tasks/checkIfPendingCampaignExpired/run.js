const checkPendingCampaigns = require('./checkPendingCampaigns');

(async () => {
  await checkPendingCampaigns();
  process.exit();
})();
