const _ = require('lodash');
const config = require('config');
const { wobjectModel } = require('models');
const { FIELDS_NAMES } = require('constants/wobjectsData');
const { processWobjects } = require('utilities/helpers/wobjectHelper');
const paymentHistoriesHelper = require('utilities/helpers/paymentHistoriesHelper');

module.exports = async (data) => {
  const {
    error, users, campaign, histories,
  } = await paymentHistoriesHelper.getSingleReport(data);
  if (error) return { error };
  if (!users.length || !campaign || !histories.length) return { error: { status: 404, message: 'Not found' } };
  return {
    result: await prepareReportData({
      users, campaign, histories, data,
    }),
  };
};

const prepareReportData = async ({
  users, campaign, histories, data,
}) => {
  let voteAmount = 0;
  const rewards = _.filter(histories, (history) => _.includes(['beneficiary_fee', 'review'], history.type));
  let rewardHive = _.sumBy(rewards, 'amount');
  const rewardUsd = _.sumBy(rewards, 'details.payableInDollars');

  const rewardRecord = _.find(histories, (history) => history.type === 'review');
  if (rewardRecord.recounted) {
    voteAmount = _.sumBy(rewards, 'details.votesAmount');
    rewardHive += voteAmount;
  }
  const { wobjects } = await getObjectsData(_.uniq([campaign.requiredObject, ...campaign.objects]));

  const sponsor = _.find(users, (usr) => usr.name === data.guideName);
  const user = _.find(users, (client) => client.name === data.userName);
  const reservation = _.find(campaign.users,
    (doer) => doer.name === _.get(rewardRecord, 'details.guestAccount', rewardRecord.userName) && doer.status === 'completed');
  const paymentData = _.find(campaign.payments,
    (payment) => payment.postPermlink === rewardRecord.details.review_permlink);
  return {
    match_bots: campaign.match_bots,
    createCampaignDate: campaign.createdAt,
    reservationDate: reservation.createdAt,
    reviewDate: rewardRecord.createdAt,
    title: _.get(paymentData, 'postTitle', ''),
    activationPermlink: campaign.activation_permlink,
    primaryObject: _.find(wobjects,
      (wobject) => wobject.author_permlink === campaign.requiredObject),
    secondaryObjects: _.filter(wobjects,
      (wobject) => wobject.author_permlink === reservation.object_permlink),
    rewardHive,
    rewardUsd,
    histories,
    sponsor: _.pick(sponsor, ['name', 'wobjects_weight', 'alias', 'json_metadata']),
    user: _.pick(user, ['name', 'wobjects_weight', 'alias', 'json_metadata']),
  };
};

const getObjectsData = async (permlinks) => {
  const { result: wobjects } = await wobjectModel.find({ author_permlink: { $in: permlinks } });

  const filteredObjects = await processWobjects(
    { wobjects, fields: FIELDS_NAMES.NAME, app: config.waivio_app_name },
  );

  return {
    wobjects: _.map(filteredObjects, (obj) => ({
      author_permlink: obj.author_permlink,
      object_name: obj.name,
    })),
  };
};
