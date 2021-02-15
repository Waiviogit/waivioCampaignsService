const _ = require('lodash');
const { campaignModel, userModel } = require('models');
const { setExpireCampaign } = require('utilities/redis/redisSetter');
const { hiveClient, hiveOperations } = require('utilities/hiveApi');

module.exports = async (data) => {
  const { user } = await userModel.findOne(data.guideName);
  if (_.get(user, 'auth.provider')) return { error: { status: 422, message: 'Guests cannot create campaigns' } };

  if (data.app) {
    data.app = await hiveClient.execute(hiveOperations.getAccountInfo, data.app) ? data.app : null;
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
  params.objects = _.filter(params.objects, (object) => object.match(/\S+/));
  return params;
};
