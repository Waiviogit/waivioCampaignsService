const _ = require('lodash');
const { campaignHelper } = require('utilities/helpers');

module.exports = async ({
  userName, sort, requiredObject, skip, limit, area, locale, appName,
  radius, guideNames, status, types, simplified, firstMapLoad,
}) => {
  if (!userName) return { error: { status: 422, message: 'userName is required' } };
  let { campaigns } = await campaignHelper.campaignsAggregation({
    userName, requiredObject, status, types,
  });
  if (!campaigns || !campaigns.length) {
    return {
      campaigns: [], campaigns_types: [], hasMore: false, sponsors: [],
    };
  }
  campaigns = campaignHelper.eligibleCampaignsFilter(campaigns, userName);
  if (!requiredObject) {
    return getPrimaryCampaigns({
      allCampaigns: campaigns,
      skip,
      limit,
      sort,
      userName,
      area,
      radius,
      simplified,
      firstMapLoad,
      guideNames,
      locale,
      appName,
    });
  }
  return campaignHelper.getSecondaryCampaigns({
    allCampaigns: campaigns,
    skip,
    limit,
    userName,
    eligible: true,
    area,
    radius,
    sort,
    guideNames,
    locale,
    appName,
  });
};

const getPrimaryCampaigns = async ({
  allCampaigns, skip, limit, sort, userName, area,
  radius, simplified, firstMapLoad, guideNames, locale, appName,
}) => {
  const { campaigns: eligibleCampaigns } = await campaignHelper.getSecondaryCampaigns({
    allCampaigns,
    skip: 0,
    limit: allCampaigns.length,
    userName,
    eligible: true,
    area,
    radius,
    sort,
    firstMapLoad,
    locale,
    appName,
    needProcess: false,
  });
  return campaignHelper.getPrimaryCampaigns({
    allCampaigns: eligibleCampaigns,
    skip,
    limit,
    sort,
    userName,
    area,
    radius,
    simplified,
    firstMapLoad,
    guideNames,
    locale,
    appName,
  });
};
