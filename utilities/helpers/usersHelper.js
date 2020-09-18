const _ = require('lodash');
const { userModel } = require('models');

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
    const isValid = {
      photos: _.get(metadata, 'image', []).length >= _.get(campaign, 'requirements.minPhotos', 0),
      followers: _.get(user, 'followers_count', 0) >= _.get(campaign, 'userRequirements.minFollowers', 0),
      posts: _.get(user, 'count_posts', 0) >= _.get(campaign, 'userRequirements.minPosts', 0),
      expertise: _.get(user, 'wobjects_weight', 0) >= _.get(campaign, 'userRequirements.minExpertise', 0),
    };
    if (_.every(Object.values(isValid))) validCampaigns.push(campaign);
  }
  return validCampaigns;
};
