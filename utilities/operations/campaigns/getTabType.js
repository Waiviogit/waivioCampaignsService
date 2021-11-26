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
    if (error || !campaigns.length) {
      tabType = 'eligible';
    }
  }

  if (error) return { error };

  return tabType;
};
