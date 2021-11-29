const getReservedCampigns = require('./getReservedCampigns');
const getEligibleCampaigns = require('./getEligibleCampaigns');

module.exports = async ({
  userName, status, locale,
}) => {
  let tabType, campaigns, error;

  ({ campaigns, error } = await getReservedCampigns({
    userName, skip: 0, status, locale, limit: 1,
  }));
  tabType = 'reserved';
  if (error || !campaigns.length) {
    ({ campaigns, error } = await getEligibleCampaigns({
      userName, skip: 0, status, locale, limit: 1,
    }));
    tabType = 'eligible';
  }
  if (error || !campaigns.length) {
    tabType = 'all';
  }

  return tabType;
};
