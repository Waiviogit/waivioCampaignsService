const _ = require('lodash');
const axios = require('axios');
const config = require('config');
const { FIELDS_NAMES } = require('constants/wobjectsData');
const { NOTIFICATIONS_ID } = require('constants/constants');
const { processWobjects } = require('utilities/helpers/wobjectHelper');
const { HOST, BASE_URL, SET_NOTIFICATION } = require('constants/appData').notificationsApi;
const {
  campaignModel, userModel, wobjectModel, Subscriptions, wobjectSubscriptions, bellWobjectModel,
} = require('models');

const URL = HOST + BASE_URL + SET_NOTIFICATION;

const sendNotification = async (operation) => {
  const reqData = {
    id: operation.id,
    block: process.env.BLOCK_NUM,
    data: operation.data,
  };

  request(reqData);
};

const request = async (reqData) => {
  const { API_KEY } = process.env;

  try {
    await axios.post(URL, reqData, { headers: { API_KEY } });
  } catch (error) {
    console.log(error.message);
  }
};

const custom = async (type, data) => {
  const operation = {
    id: type,
    data,
  };

  await sendNotification(operation);
};

const activateCampaign = async (campaignId) => {
  const { result: id, error } = await campaignModel.getCampaignId(campaignId);
  if (error) return;
  const { result: campaign, error: campaignError } = await campaignModel.findOne({ _id: id });
  if (campaignError || !campaign) return;
  const { wobjFollowers = [] } = await wobjectSubscriptions
    .getFollowers({ following: campaign.requiredObject });
  const { users } = await userModel.find({ name: { $in: wobjFollowers } });
  const { subscriptionData } = await Subscriptions
    .find({ condition: { following: campaign.guideName } });
  if (!users || !users.length) return;
  let names = _.map(users, 'name');
  const guideFollowings = _.map(subscriptionData, 'follower');
  names = _.concat(names, guideFollowings);
  const { objectName, error: wobjError } = await getWobjectName(campaign.requiredObject);
  if (wobjError) return;

  const operation = {
    id: NOTIFICATIONS_ID.ACTIVATION_CAMPAIGN,
    data: {
      guide: campaign.guideName,
      users: [...new Set(names)],
      author_permlink: campaign.requiredObject,
      object_name: objectName,
    },
  };
  await sendNotification(operation);
  await sendBellNotification({
    objects: campaign.objects,
    primaryObject: campaign.requiredObject,
    guideName: campaign.guideName,
  });
};

const sendBellNotification = async ({ objects, primaryObject, guideName }) => {
  for (const object of objects) {
    const { users } = await bellWobjectModel.getFollowers({ following: object });
    if (_.isEmpty(users)) continue;
    const { objectName } = await getWobjectName(object);
    const operation = {
      id: NOTIFICATIONS_ID.BELL_WOBJ_REWARDS,
      data: {
        objectName,
        objectPermlink: object,
        users,
        primaryObject,
        guideName,
      },
    };
    await sendNotification(operation);
  }
};

const getWobjectName = async (permlink) => {
  const { result: wobject, error } = await wobjectModel.findOne(permlink);
  if (error || !wobject) return { error: 'Something wrong' };
  const processedWobj = await processWobjects({
    wobjects: [wobject],
    fields: [FIELDS_NAMES.NAME],
    app: config.waivio_app_name,
    returnArray: false,
  });
  return { objectName: processedWobj.name };
};

module.exports = { custom, activateCampaign };
