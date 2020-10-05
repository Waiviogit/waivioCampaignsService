const _ = require('lodash');
const { campaignModel, userModel } = require('models');
const { getWobjects } = require('utilities/helpers/wobjectHelper');

module.exports = async ({ _id, postPermlink, userName }) => {
  const { result: campaign } = await campaignModel.findOne({ _id });
  if (!campaign) return { error: { success: false, message: 'Campaign not found' } };
  const secondaryPermlink = getSecondaryPermlink({ campaign, postPermlink, userName });
  const { wobjects } = await getWobjects({ campaigns: [campaign] });
  const alias = await getGuideAlias(campaign.guideName);
  const { requiredObject, secondaryObject } = fillObjects({
    wobjects, primaryPermlink: campaign.requiredObject, secondaryPermlink,
  });
  return {
    campaign: {
      _id,
      alias,
      requiredObject,
      secondaryObject,
      app: campaign.app,
      name: campaign.name,
      guideName: campaign.guideName,
      requirements: campaign.requirements,
      userRequirements: campaign.userRequirements,
    },
  };
};

const getSecondaryPermlink = ({ campaign, postPermlink, userName }) => {
  if (postPermlink) {
    const payment = _.find(campaign.payments, (el) => el.postPermlink === postPermlink);
    return _.get(payment, 'objectPermlink');
  }
  const user = _.find(campaign.users,
    (u) => u.status === 'assigned' && u.name === userName);
  return _.get(user, 'object_permlink');
};

const fillObjects = ({ wobjects, primaryPermlink, secondaryPermlink }) => {
  wobjects = _.map(wobjects, (wobj) => ({
    author_permlink: wobj.author_permlink,
    name: wobj.name || wobj.default_name,
    object_type: wobj.object_type,
  }));
  const requiredObject = _.find(wobjects, (w) => w.author_permlink === primaryPermlink);
  const secondaryObject = _.find(wobjects, (w) => w.author_permlink === secondaryPermlink);
  return { requiredObject, secondaryObject };
};

const getGuideAlias = async (name) => {
  const { user } = await userModel.findOne(name);
  if (!user) return '';
  if (user.alias) return user.alias;
  try {
    const metadata = user.posting_json_metadata
      ? JSON.parse(user.posting_json_metadata)
      : JSON.parse(user.json_metadata);
    return _.get(metadata, 'profile.name', '');
  } catch (e) {
    return '';
  }
};
