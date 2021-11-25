const getReservedCampigns = require('./getReservedCampigns');
const getEligibleCampaigns = require('./getEligibleCampaigns');

module.exports = async ({
  userName, skip, status, locale,
}) => {

  const limit = 1;
  let campaigns, error, tabType;

  ({ campaigns, error } = await getReservedCampigns({
    userName, skip, status, locale, limit,
  }));
  tabType = 'reserved';
  if (error || !campaigns.length) {
    ({ campaigns, error } = await getEligibleCampaigns({
      userName, skip, status, locale, limit,
    }));
    tabType = 'eligible';
  }
  if (error || !campaigns.length) {
    tabType = 'all';
  }
  if (error) return { error };

  return tabType;
};
