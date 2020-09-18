const _ = require('lodash');
const campaignModel = require('models/campaignModel.js');
const matchBotHelper = require('utilities/helpers/matchBotHelper.js');
const { RESERVATION_STATUSES } = require('constants/constants');
const { checkOnHoldStatus } = require('utilities/helpers/campaignsHelper');

const updateCampaigns = async ({
  campaign, user, operation, isCompleted = false,
}) => {
  await campaignModel.updateOne({
    _id: campaign._id.toString(),
    users: {
      $elemMatch: {
        name: user.name,
        status: user.status,
        permlink: user.permlink,
      },
    },
  }, {
    $set: {
      'users.$.status': RESERVATION_STATUSES.REJECTED,
      'users.$.rejection_permlink': operation.permlink,
    },
  });
  if (isCompleted) {
    await campaignModel.updateOne(
      {
        _id: campaign._id,
        payments: { $elemMatch: { reservationId: user._id.toString() } },
      }, {
        $set: {
          'payments.$.status': RESERVATION_STATUSES.REJECTED,
          'payments.$.rejectionPermlink': operation.permlink,
        },
      },
    );
  }
};

module.exports = async (operation) => {
  const { result: campaign } = await campaignModel.findOne(
    {
      guideName: operation.guideName,
      users: { $elemMatch: { permlink: operation.parent_permlink } },
    },
  );
  if (!campaign) return;

  const user = _.find(campaign.users, (member) => member.permlink === operation.parent_permlink);
  if (!user) return;
  switch (user.status) {
    case 'assigned':
      await updateCampaigns({ campaign, user, operation });
      await checkOnHoldStatus(campaign.activation_permlink);
      break;
    case 'completed':
      const payment = _.find(campaign.payments,
        (member) => member.userName === user.name && member.objectPermlink === user.object_permlink && member.status === 'active');

      const upvoteResult = await matchBotHelper.removeVotes(payment, user.permlink);
      if (upvoteResult) {
        await matchBotHelper.checkAndRemoveHistories(operation.parent_permlink);
      }
      await updateCampaigns({
        campaign, user, operation, isCompleted: true,
      });
      break;
  }
};
