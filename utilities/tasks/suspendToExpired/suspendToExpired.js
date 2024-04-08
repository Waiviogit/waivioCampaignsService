const { CAMPAIGN_STATUSES } = require('constants/constants');
const { CampaignV2 } = require('database').models;
const moment = require('moment');
const _ = require('lodash');

const getStatusAfterSuspend = (campaign) => {
  if (campaign.deactivationPermlink) return CAMPAIGN_STATUSES.INACTIVE;
  if (campaign.expiredAt < new Date()) return CAMPAIGN_STATUSES.EXPIRED;
  if (campaign.activationPermlink) {
    const completedUsers = _.filter(
      campaign.users,
      (user) => user.createdAt > moment.utc().startOf('month').toDate(),
    );
    return campaign.budget - campaign.reward * completedUsers.length
    > campaign.reward
      ? CAMPAIGN_STATUSES.SUSPENDED
      : CAMPAIGN_STATUSES.REACHED_LIMIT;
  }
  return CAMPAIGN_STATUSES.PENDING;
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
