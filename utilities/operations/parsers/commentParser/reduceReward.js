const _ = require('lodash');
const campaignModel = require('models/campaignModel.js');
const matchBotHelper = require('utilities/helpers/matchBotHelper.js');

const reduceCampaign = async ({
  campaignId, userId, permlink, reduceAmount,
}) => {
  await campaignModel.updateOne({
    _id: campaignId,
    users: { $elemMatch: { _id: userId } },
  },
  { 'users.$.rewardReducedBy': reduceAmount, 'users.$.reduce_reward_permlink': permlink });
};

module.exports = async ({
  parentPermlink, activationPermlink, userName, permlink, reduceAmount,
}) => {
  const { result: campaign } = await campaignModel.findOne(
    { activation_permlink: activationPermlink },
  );
  if (!campaign) return false;

  const user = _.find(campaign.users, { name: userName, permlink: parentPermlink });
  if (!user || !_.includes(['assigned', 'completed'], user.status)) return;
  await reduceCampaign({
    campaignId: campaign._id, userId: user._id, permlink, reduceAmount,
  });
  if (user.status === 'completed') {
    await matchBotHelper.recountMatchBotVotes(
      { user, reward: campaign.reward, amount: reduceAmount },
    );
  }
};
