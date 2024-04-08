const { CAMPAIGN_STATUSES } = require('constants/constants');
const { CampaignV2 } = require('database').models;

const getStatusAfterSuspend = (campaign) => {
  if (campaign.deactivationPermlink) return CAMPAIGN_STATUSES.INACTIVE;
  if (campaign.expiredAt < new Date()) return CAMPAIGN_STATUSES.EXPIRED;
  return CAMPAIGN_STATUSES.SUSPENDED;
};

module.exports = async () => {
  const campaigns = await CampaignV2.find({ status: 'suspended' }).lean();

  for (const campaign of campaigns) {
    const status = getStatusAfterSuspend(campaign);
    if (status === CAMPAIGN_STATUSES.SUSPENDED) continue;
    await CampaignV2.updateOne({ _id: campaign._id }, { status });
  }
  console.log('task completed');
};
