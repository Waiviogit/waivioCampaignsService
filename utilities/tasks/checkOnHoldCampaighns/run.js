const checkOnHoldCampaigns = require('./checkOnHoldCampaigns');

(async () => {
  await checkOnHoldCampaigns();
  process.exit();
})();
