const _ = require('lodash');
const axios = require('axios');
const { NOTIFICATIONS_ID } = require('constants/constants');
const { getWobjectName } = require('utilities/helpers/wobjectHelper');
const { HOST, BASE_URL, SET_NOTIFICATION } = require('constants/appData').notificationsApi;
const {
  campaignModel, userModel, Subscriptions, wobjectSubscriptions,
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

const campaignWithWobjFollowers = async (campaignId) => {
  const { result: id, error } = await campaignModel.getCampaignId(campaignId);
  if (error) return { error: { message: 'Campaign id not found' } };
  const { result: campaign, error: campaignError } = await campaignModel.findOne({ _id: id });
  if (campaignError || !campaign) return { error: { message: 'Campaign not found' } };
  const { wobjFollowers = [] } = await wobjectSubscriptions
    .getFollowers({ following: campaign.requiredObject });
  const { users } = await userModel.find({ name: { $in: wobjFollowers } });
  if (!users || !users.length) return { error: { message: 'Users not found' } };
  return { campaign, users, error };
};

const activateCampaign = async (campaignId) => {
  const { campaign, users, error } = await campaignWithWobjFollowers(campaignId);
  if (error) return;
  const { subscriptionData } = await Subscriptions
    .find({ condition: { following: campaign.guideName } });
  let followers = _.map(users, 'name');
  const guideFollowers = _.map(subscriptionData, 'follower');
  followers = _.concat(followers, guideFollowers);
  const { objectName, error: wobjError } = await getWobjectName(campaign.requiredObject);
  if (wobjError) return;

  const operation = {
    id: NOTIFICATIONS_ID.ACTIVATION_CAMPAIGN,
    data: {
      guide: campaign.guideName,
      users: [...new Set(followers)],
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

const deactivateCampaign = async (campaignId) => {
  const { campaign, users, error } = await campaignWithWobjFollowers(campaignId);
  if (error) return;
  const { objectName, error: wobjError } = await getWobjectName(campaign.requiredObject);
  if (wobjError) return;
  const followers = _.concat(_.map(users, 'name'), campaign.guideName);

  const operation = {
    id: NOTIFICATIONS_ID.DEACTIVATION_CAMPAIGN,
    data: {
      guide: campaign.guideName,
      users: [...new Set(followers)],
      author_permlink: campaign.requiredObject,
      object_name: objectName,
    },
  };
  await sendNotification(operation);
};

const sendBellNotification = async ({ objects, primaryObject, guideName }) => {
  for (const object of objects) {
    const { users } = await wobjectSubscriptions.getBellFollowers({ following: object });
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

module.exports = { custom, activateCampaign, deactivateCampaign };
