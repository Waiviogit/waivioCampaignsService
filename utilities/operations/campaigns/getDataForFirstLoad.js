const _ = require('lodash');
const { paymentHistoryModel, campaignModel } = require('models');
const getReservedCampigns = require('./getReservedCampigns');
const getEligibleCampaigns = require('./getEligibleCampaigns');
const getAllCampaigns = require('./getAllCampaigns');

module.exports = async ({
  userName, sort, area, limit, skip, status, locale, appName,
}) => {
  const { campaigns: expCampaigns } = await campaignModel.getCounts(
    { guideName: userName, status: { $in: ['inactive', 'expired', 'deleted', 'payed'] } },
  );
  const { result: [tookPartInCampaigns] } = await campaignModel.aggregate(
    tookPartCampaignPipe(userName),
  );
  const { campaigns: allCampaigns } = await campaignModel.getCounts({ guideName: userName });
  const { result: receivable } = await paymentHistoryModel.find({ userName });
  const { result: payable } = await paymentHistoryModel.find({ sponsor: userName });

  let campaigns, types, hasMore, sponsors, error, tabType;

  ({
    campaigns, campaigns_types: types, hasMore, sponsors, error,
  } = await getReservedCampigns({
    userName, sort, area, limit, skip, status, locale, appName,
  }));
  tabType = 'reserved';
  if (error || !campaigns.length) {
    ({
      campaigns, campaigns_types: types, hasMore, sponsors, error,
    } = await getEligibleCampaigns({
      userName, sort, area, limit, skip, status, locale, appName,
    }));
    tabType = 'eligible';
  } if (error || !campaigns.length) {
    ({
      campaigns, campaigns_types: types, hasMore, sponsors, error,
    } = await getAllCampaigns({
      userName, sort, area, limit, skip, status, locale, appName,
    }));
    tabType = 'all';
    if (error) return { error };
  }

  return {
    count_history_campaigns: expCampaigns,
    campaigns,
    hasMore,
    sponsors,
    campaigns_types: types,
    tabType,
    count_took_part_campaigns: _.get(tookPartInCampaigns, 'count', 0),
    count_campaigns: allCampaigns,
    has_receivable: !_.isEmpty(receivable),
    has_payable: !_.isEmpty(payable),
  };
};

const tookPartCampaignPipe = (name) => [
  { $unwind: '$users' },
  { $match: { 'users.name': name } },
  { $count: 'count' },
];
