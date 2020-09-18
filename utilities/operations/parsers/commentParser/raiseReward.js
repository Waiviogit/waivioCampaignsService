const { campaignModel } = require('models');

module.exports = async ({
  user, parentPermlink, activationPermlink, guideName, permlink, riseAmount,
}) => {
  const { result: campaign } = await campaignModel.findOne(
    { activation_permlink: activationPermlink },
  );
  if (!campaign || campaign.guideName !== guideName) return;

  const { result } = await campaignModel.updateOne({
    activation_permlink: activationPermlink,
    users: {
      $elemMatch: {
        name: user,
        permlink: parentPermlink,
      },
    },
  }, { 'users.$.rewardRaisedBy': riseAmount, 'users.$.rise_reward_permlink': permlink });

  return !!result;
};
