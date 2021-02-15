const _ = require('lodash');
const campaignModel = require('models/campaignModel.js');
const { RESERVATION_STATUSES } = require('constants/constants.js');
const paymentHelper = require('utilities/helpers/paymentsHelper.js');
const jsonHelper = require('utilities/helpers/jsonHelper');
const { hiveClient, hiveOperations } = require('utilities/hiveApi');

const prepareCampaignData = (userData, campaign) => ({
  hiveCurrency: userData.hiveCurrency,
  rewardRaisedBy: userData.rewardRaisedBy,
  reward: campaign.reward,
  userName: userData.name,
  commissionAgreement: campaign.commissionAgreement,
  userReservationObject: userData.object_permlink,
  guideName: campaign.guideName,
  userReservationPermlink: userData.permlink,
  requiredObject: campaign.requiredObject,
  campaignId: campaign._id,
});

module.exports = async ({
  parentPermlink, guideName, user,
}) => {
  let { result: campaign } = await campaignModel.findOne(
    {
      guideName,
      users: { $elemMatch: { permlink: parentPermlink } },
    },
  );
  if (!campaign) return;
  campaign = campaign.toObject();

  /** Find reservation and debt record in campaign data */
  const userData = _.find(campaign.users, { rootName: user, permlink: parentPermlink });
  if (!userData || userData.status !== RESERVATION_STATUSES.REJECTED) return;
  const paymentData = _.find(campaign.payments,
    (pmnt) => pmnt.reservationId.toString() === userData._id.toString());

  if (paymentData) {
    /** Find post for get beneficiaries from it */
    const post = await hiveClient.execute(hiveOperations.getPostInfo,
      { author: paymentData.rootAuthor, permlink: paymentData.postPermlink });

    /** Prepare correct campaign data */
    const campaignForReview = prepareCampaignData(userData, campaign);
    /** Create new payment debts, we call this method without title - in order not to create some
     records related to the match bot and duplication of debts in the campaign */
    await paymentHelper.createReview({
      campaigns: [campaignForReview],
      owner_account: userData.name === userData.rootName ? null : userData.rootName,
      app: campaign.campaign_server,
      objects: [userData.object_permlink],
      beneficiaries: post.beneficiaries,
      permlink: post.permlink,
      host: _.get(jsonHelper.parseJson(post.json_metadata), 'host', null),
    });
    /** Update debt record with new status, and remove rejection permlink */
    await campaignModel.updateOne({
      _id: campaign._id,
      payments: {
        $elemMatch: {
          reservationId: paymentData.reservationId.toString(),
        },
      },
    }, {
      $set: {
        'payments.$.status': RESERVATION_STATUSES.ACTIVE,
        'payments.$.rejectionPermlink': '',
      },
    });
  }
  /** Update reservation record with new status, and remove rejection permlink */
  await campaignModel.updateOne({
    _id: campaign._id,
    users: {
      $elemMatch: {
        name: userData.name,
        status: userData.status,
        permlink: userData.permlink,
      },
    },
  }, {
    $set: {
      'users.$.status': paymentData ? RESERVATION_STATUSES.COMPLETED : RESERVATION_STATUSES.ASSIGNED,
      'users.$.rejection_permlink': '',
    },
  });
};
