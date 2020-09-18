const unassignUsers = require('./unassignUsersFromCampaign');

(async () => {
  await unassignUsers();
  process.exit();
})();
