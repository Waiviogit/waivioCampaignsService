const _ = require('lodash');
const { Subscriptions, wobjectSubscriptions } = require('models');
const { campaignHelper } = require('utilities/helpers');

module.exports = async (params) => {
  const {
    skip, limit, sort, name,
  } = params;
  const { wobjects = [] } = await wobjectSubscriptions.getFollowings({ follower: name });

  const { users } = await Subscriptions.getFollowings({ follower: name });
  let { campaigns } = await campaignHelper.campaignsAggregation({ status: ['active'], userName: name });

  if (!campaigns || !campaigns.length) {
    return {
      campaigns: [], campaigns_types: [], hasMore: false, sponsors: [],
    };
  }
  campaigns = campaignHelper.eligibleCampaignsFilter(campaigns, name);

  const resultArr = _.filter(campaigns, (el) => (
    _.includes(users, el.guideName) || _.includes(wobjects, el.requiredObject)
  ));

  return getPrimaryCampaigns({
    allCampaigns: resultArr,
    skip,
    limit,
    sort,
    userName: name,
  });
};

const getPrimaryCampaigns = async ({
  allCampaigns, skip, limit, sort, userName,
}) => {
  const { campaigns: eligibleCampaigns } = await campaignHelper.getSecondaryCampaigns({
    allCampaigns,
    skip: 0,
    limit: allCampaigns.length,
    userName,
    eligible: true,
    sort,
  });
  return campaignHelper.getPrimaryCampaigns({
    allCampaigns: eligibleCampaigns,
    skip,
    limit,
    sort,
    userName,
  });
};
