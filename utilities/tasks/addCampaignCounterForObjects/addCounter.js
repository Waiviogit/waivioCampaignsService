const { wobjectModel } = require('models');
const { Campaign } = require('database').models;
const { CAMPAIGN_STATUSES } = require('constants/constants');

module.exports = async () => {
  const campaigns = await Campaign.find(
    { status: CAMPAIGN_STATUSES.ACTIVE }, { objects: 1, requiredObject: 1 },
  ).lean();

  for (const campaign of campaigns) {
    await wobjectModel.updateCampaignsCount({
      wobjPermlinks: [campaign.requiredObject, ...campaign.objects],
      status: CAMPAIGN_STATUSES.ACTIVE,
      id: campaign._id,
    });
  }

  console.info('task completed');
};
