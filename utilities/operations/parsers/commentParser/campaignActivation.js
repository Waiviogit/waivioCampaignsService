const _ = require('lodash');
const { campaignModel, wobjectModel } = require('models');
const { activeCampaignStatuses, CAMPAIGN_STATUSES } = require('constants/constants');
const preValidationHelper = require('utilities/helpers/preValidationHelper');

exports.activate = async (campaignId, guideName, permlink) => {
  const { result: _id, error } = campaignModel.getCampaignId(campaignId);
  if (error) return { result: false };
  const { is_valid: isValid } = await preValidationHelper.validateActivation(
    { campaign_id: _id, guide_name: guideName, permlink },
  );
  if (!isValid) return { result: false };

  const { result: campaign } = await campaignModel.findOne(
    { guideName, status: CAMPAIGN_STATUSES.SUSPENDED },
  );
  const status = campaign ? CAMPAIGN_STATUSES.SUSPENDED : CAMPAIGN_STATUSES.ACTIVE;

  const { result } = await campaignModel.updateOne(
    { _id, status: CAMPAIGN_STATUSES.PENDING, guideName },
    { status, activation_permlink: permlink }, { new: true },
  );
  if (result) {
    await wobjectModel.updateCampaignsCount({
      wobjPermlinks: [result.requiredObject, ...result.objects],
      status,
      id: result._id,
    });
  }
  return { result: !!result };
};

/**
 * Validate deactivation and if valid => change campaign status
 * @param data
 * @returns {Promise<{result: boolean}>}
 */
exports.inactivate = async (data) => {
  const { is_valid: isValid, campaign } = await preValidationHelper.validateInactivation(data);
  if (!isValid) return { result: false };

  const assigns = _.filter(campaign.users, (user) => user.status === 'assigned');
  const status = assigns.length ? CAMPAIGN_STATUSES.ON_HOLD : CAMPAIGN_STATUSES.INACTIVE;
  const { result } = await campaignModel.updateOne({
    activation_permlink: data.campaign_permlink,
    guideName: data.guide_name,
    status: { $in: activeCampaignStatuses },
  },
  { status, deactivation_permlink: data.permlink });

  if (result) {
    await wobjectModel.updateCampaignsCount({
      wobjPermlinks: [result.requiredObject, ...result.objects],
      status,
      id: result._id,
    });
  }

  return { result: !!result };
};
