const { wobjectModel, campaignModel } = require('models');
const { campaignHelper } = require('utilities/helpers');
const _ = require('lodash');

module.exports = async ({ authorPermlink, userName, locale }) => {
  const { result: wobject, error } = await wobjectModel.findOne(
    { author_permlink: authorPermlink, activeCampaignsCount: { $gt: 0 } },
  );
  if (!wobject || error) return { error: { message: 'Not Found', status: 404 } };
  const { campaigns, error: campaignsError } = await campaignModel
    .find({ _id: { $in: _.get(wobject, 'activeCampaigns', []) } });
  if (_.isEmpty(campaigns) || campaignsError) return { error: { message: 'Not Found', status: 404 } };

  return campaignHelper.processCampaignsByWobject({
    campaigns, wobject, userName, locale,
  });
};
