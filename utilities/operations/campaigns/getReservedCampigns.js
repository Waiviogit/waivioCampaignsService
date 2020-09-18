const _ = require('lodash');
const { campaignHelper } = require('utilities/helpers');
const { maxMapRadius } = require('constants/constants');

module.exports = async ({
  userName, sort, skip, limit, area,
  radius, guideNames, types, status, locale, appName,
}) => {
  if (!userName) return { error: { status: 422, message: 'userName is required' } };
  const matchData = [{ $match: { status: { $in: status }, users: { $elemMatch: { name: userName, status: 'assigned' } } } }];
  if (types) matchData[0].$match.type = { $in: types };
  const { campaigns } = await campaignHelper.getCampaigns({ matchData });
  if (!campaigns || !campaigns.length) {
    return {
      campaigns: [], campaigns_types: [], hasMore: false, sponsors: [], radius: maxMapRadius,
    };
  }
  const result = await campaignHelper.getSecondaryCampaigns({
    allCampaigns: campaigns,
    skip,
    limit,
    userName,
    reserved: true,
    area,
    radius,
    sort,
    guideNames,
    locale,
    appName,
  });
  if (result.campaigns.length) {
    result.campaigns = _.forEach(result.campaigns, (campaign) => {
      campaign.objects = _.filter(campaign.objects, (obj) => obj.assigned);
    });
  }
  return result;
};
