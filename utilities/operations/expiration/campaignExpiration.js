const { campaignModel } = require('models');
const { redisGetter, redisSetter } = require('utilities/redis');

/** Listen redis ttl and expire campaigns */
exports.expireCampaign = async (data) => {
  const _id = data.replace('expire:campaign_', '');
  const { result } = await campaignModel.updateOne({ _id, status: { $in: ['active', 'reachedLimit'] } }, { status: 'expired' });

  if (result) console.log(`Campaign expired: ${_id}`);
  else console.log(`Campaign not expired: ${_id}`);
};

/** Listen redis ttl and expire campaigns reservations */
exports.expireAssinged = async (data) => {
  const assignPermlink = data.replace('expire:', '');
  let assignData;
  const { result: notParsingParams } = await redisGetter.getTTLCampaignsData(assignPermlink);

  try {
    assignData = JSON.parse(notParsingParams);
  } catch (error) {
    console.log(error.message);
  }
  if (!assignData) return null;
  const { result } = await campaignModel.updateOne({
    activation_permlink: assignData.campaign_permlink,
    users: {
      $elemMatch: {
        name: assignData.user_name,
        status: 'assigned',
        permlink: assignData.assign_permlink,
      },
    },
  },
  { $set: { 'users.$.status': 'expired' } });

  if (result) {
    /** Not need now */
    // await UserWobjects.create({
    //   user_name: assignData.user_name,
    //   author_permlink: assignData.approved_object,
    //   weight: -1,
    // });
    await redisSetter.deleteCampaignsData(assignPermlink);
    console.log(`User: ${assignData.user_name} assign expired in campaign permlink: ${assignData.campaign_permlink}`);
    await this.checkOnHoldStatus(assignData.campaign_permlink);
  }
};
