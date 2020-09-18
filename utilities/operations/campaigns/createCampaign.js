const _ = require('lodash');
const { wobjectModel, campaignModel, userModel } = require('models');
const { steemHelper } = require('utilities/helpers');
const { setExpireCampaign } = require('utilities/redis/redisSetter');

module.exports = async (data) => {
  const { user } = await userModel.findOne(data.guideName);
  if (_.get(user, 'auth.provider')) return { error: { status: 422, message: 'Guests cannot create campaigns' } };

  if (data.app) {
    data.app = await steemHelper.getAccountInfo(data.app) ? data.app : null;
  }
  if (data.id) {
    const { result: _id, error: idError } = campaignModel.getCampaignId(data.id);
    if (idError) return { error: idError };
    const { result: existCampaign } = await campaignModel.findOne({ _id, status: 'pending' });

    if (existCampaign) {
      const { result, error: updateError } = await campaignModel.updateOne(
        { _id, status: 'pending' }, await createParams(data), { runValidators: true, new: true },
      );
      if (updateError) return { error: updateError };
      await setExpireCampaign(result._doc);
      return { campaign: result };
    }
  }
  const { campaign, error } = await campaignModel.create(await createParams(data));
  if (error) return { error };
  await setExpireCampaign(campaign._doc);
  return { campaign };
};

const createParams = async (params) => {
  const { result: requiredObject } = await wobjectModel.findOne(params.requiredObject);

  params.objects = _.filter(params.objects, (object) => object.match(/\S+/));
  if (_.get(requiredObject, 'map.coordinates', false)) {
    params.map = { type: 'Point', coordinates: requiredObject.map.coordinates };
  }

  return params;
};
