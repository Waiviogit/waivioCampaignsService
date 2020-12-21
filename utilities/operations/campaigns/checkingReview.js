const _ = require('lodash');
const { campaignModel, userModel } = require('models');
const { getWobjects } = require('utilities/helpers/wobjectHelper');

module.exports = async ({
  _id, postPermlink, userName, locale,
}) => {
  const { result: campaign } = await campaignModel.findOne({ _id });
  if (!campaign) return { error: { success: false, message: 'Campaign not found', status: 404 } };
  const secondaryPermlink = getSecondaryPermlink({ campaign, postPermlink, userName });
  const { wobjects } = await getWobjects({ campaigns: [campaign], locale });
  const { user, error } = await userModel.findOne(campaign.guideName);
  if (!user || error) return { error: { success: false, message: `guideName ${campaign.guideName} not found`, status: 500 } };
  const alias = _.get(user, 'alias', '');
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
    const payment = _.find(
      campaign.payments, (el) => el.postPermlink === postPermlink && el.userName === userName,
    );
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
