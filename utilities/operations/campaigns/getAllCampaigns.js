const { maxMapRadius } = require('constants/constants');
const { campaignHelper } = require('utilities/helpers');

module.exports = async ({
  userName, sort, requiredObject, skip, limit, area, appName, locale,
  radius, primaryObject, status, guideNames, types, simplified, firstMapLoad,
}) => {
  let { campaigns } = await campaignHelper.campaignsAggregation({
    userName, requiredObject, primaryObject, status, types,
  });
  if (!campaigns || !campaigns.length) {
    return {
      campaigns: [], campaigns_types: [], hasMore: false, sponsors: [], radius: maxMapRadius,
    };
  }
  campaigns = campaignHelper.checkCampaignsBudget(campaigns, userName);

  if (!requiredObject) {
    return campaignHelper.getPrimaryCampaigns({
      allCampaigns: campaigns,
      skip,
      limit,
      sort,
      userName,
      area,
      simplified,
      firstMapLoad,
      radius,
      guideNames,
      locale,
      appName,
    });
  }
  return campaignHelper.getSecondaryCampaigns({
    allCampaigns: campaigns, skip, limit, userName, area, radius, sort, guideNames, locale, appName,
  });
};
