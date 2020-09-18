const _ = require('lodash');
const { campaignModel, userModel } = require('models');
const { wobjectHelper } = require('utilities/helpers');

module.exports = async (data) => {
  const { result: _id, error: idError } = campaignModel.getCampaignId(data.campaign_id);
  if (idError) return { error: idError };

  const { error, result: campaign } = await campaignModel.findOne({ _id });
  if (error) return { error };
  if (!campaign) return { campaign: null };
  campaign._doc.alias = await getGuideAlias(campaign.guideName);
  const { wobjects } = await wobjectHelper.getWobjects(
    { campaigns: [campaign], locale: data.locale, appName: data.appName },
  );
  const { campaignWithObjects } = fillObjects(campaign, wobjects);

  return { campaign: campaignWithObjects };
};

const getGuideAlias = async (name) => {
  const { user } = await userModel.findOne(name);
  if (!user) return '';
  try {
    const metadata = JSON.parse(user.posting_json_metadata);
    return user.alias || _.get(metadata, 'profile.name', '');
  } catch (e) {
    return '';
  }
};

const mapWobjects = (wobjects) => _.map(wobjects, (wobj) => ({
  author_permlink: wobj.author_permlink,
  name: wobj.name || wobj.default_name,
  object_type: wobj.object_type,
}));

const fillObjects = (campaign, wobjects) => {
  campaign = campaign.toObject();
  wobjects = mapWobjects(wobjects);
  campaign.requiredObject = _.find(wobjects,
    (wobj) => wobj.author_permlink === campaign.requiredObject);
  campaign.objects = _.map(campaign.objects, (obj) => _.find(wobjects,
    (wobj) => wobj.author_permlink === obj));
  return { campaignWithObjects: campaign };
};
