const _ = require('lodash');
const { userModel, blacklistModel } = require('models');

const validateBlacklist = async (guide, user) => {
  const { blackList, error } = await blacklistModel.findOne({ user: guide });
  if (!blackList) return true;
  if (error) return false;
  const list = [...blackList.blackList];
  for (const item of blackList.followLists) {
    list.push(...item.blackList);
  }
  return !_.includes(list, user);
};

exports.validateEmail = async (email, userName) => {
  const { user } = await userModel.findOne(userName, '+privateEmail');
  if (!_.get(user, 'privateEmail')) return 'No email';
  return _.get(user, 'privateEmail') === email;
};

exports.validateReview = async (metadata, author, campaigns) => {
  const validCampaigns = [];
  const { user, error } = await userModel.findOne(author);
  if (!user || error) return [];
  user.wobjects_weight = user.wobjects_weight < 0 ? 0 : user.wobjects_weight;
  for (const campaign of campaigns) {
    const blacklisted = await validateBlacklist(campaign.guideName, author);
    const isValid = {
      photos: _.get(metadata, 'image', []).length >= _.get(campaign, 'requirements.minPhotos', 0),
      followers: _.get(user, 'followers_count', 0) >= _.get(campaign, 'userRequirements.minFollowers', 0),
      posts: _.get(user, 'count_posts', 0) >= _.get(campaign, 'userRequirements.minPosts', 0),
      expertise: _.get(user, 'wobjects_weight', 0) >= _.get(campaign, 'userRequirements.minExpertise', 0),
      blacklisted,
    };
    if (_.every(Object.values(isValid))) validCampaigns.push(campaign);
  }
  return validCampaigns;
};
