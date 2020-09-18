const _ = require('lodash');
const { campaignModel } = require('models');
const { activeCampaignStatuses } = require('constants/constants');
const preValidationHelper = require('utilities/helpers/preValidationHelper');

exports.activate = async (campaignId, guideName, permlink) => {
  const { result: _id, error } = campaignModel.getCampaignId(campaignId);
  if (error) return { result: false };
  const { is_valid: isValid } = await preValidationHelper.validateActivation(
    { campaign_id: _id, guide_name: guideName, permlink },
  );
  if (!isValid) return { result: false };

  const { result: campaign } = await campaignModel.findOne({ guideName, status: 'suspended' });
  const status = campaign ? 'suspended' : 'active';

  const { result } = await campaignModel.updateOne(
    { _id, status: 'pending', guideName },
    { status, activation_permlink: permlink }, { new: true },
  );
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
  const status = assigns.length ? 'onHold' : 'inactive';
  const { result } = await campaignModel.updateOne({
    activation_permlink: data.campaign_permlink,
    guideName: data.guide_name,
    status: { $in: activeCampaignStatuses },
  },
  { status, deactivation_permlink: data.permlink });

  return { result: !!result };
};
