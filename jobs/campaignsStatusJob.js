const schedule = require('node-schedule');
const { campaignModel } = require('models');
const wobjectHelper = require('utilities/helpers/wobjectHelper');
const { CAMPAIGN_STATUSES } = require('constants/constants');

schedule.scheduleJob('0 0 1 * *', async () => {
  const { result } = await campaignModel.updateMany(
    { status: CAMPAIGN_STATUSES.REACHED_LIMIT }, { status: CAMPAIGN_STATUSES.ACTIVE },
  );
  await wobjectHelper.updateCampaignsCountForManyCampaigns(
    { status: CAMPAIGN_STATUSES.REACHED_LIMIT }, CAMPAIGN_STATUSES.ACTIVE,
  );
  if (result && result.nModified) {
    console.log(`Successfully return status active for ${result.nModified} reached limit campaigns`);
  }
});
