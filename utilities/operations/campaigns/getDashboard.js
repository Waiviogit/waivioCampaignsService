const _ = require('lodash');
const moment = require('moment');
const { wobjectModel } = require('models');
const { campaignHelper, wobjectHelper } = require('utilities/helpers');
const { currencyRequest } = require('utilities/requests');
const { hiveClient, hiveOperations } = require('utilities/hiveApi');
const paymentHistory = require('../paymentHistory');

module.exports = async (data) => {
  const limitDate = moment.utc().startOf('month').toDate();
  const { campaigns: dashboard, error } = await campaignHelper.getCampaigns({
    matchData: [
      { $match: { guideName: data.guideName } },
      {
        $addFields: {
          completed: { $size: { $filter: { input: '$users', as: 'user', cond: { $and: [{ $eq: ['$$user.status', 'completed'] }, { $gt: ['$$user.completedAt', limitDate] }] } } } },
          reserved: { $size: { $filter: { input: '$users', as: 'user', cond: { $and: [{ $eq: ['$$user.status', 'assigned'] }, { $gt: ['$$user.createdAt', limitDate] }] } } } },
          completedTotal: { $size: { $filter: { input: '$users', as: 'user', cond: { $eq: ['$$user.status', 'completed'] } } } },
        },
      },
      ...guideLookup(),
      { $sort: { createdAt: -1 } },
      {
        $project: {
          name: 1,
          activation_permlink: 1,
          status: 1,
          type: 1,
          users: 1,
          frequency_assign: 1,
          budget: 1,
          reward: 1,
          reserved: 1,
          completed: 1,
          completedTotal: 1,
          match_bots: 1,
          agreementObjects: 1,
          usersLegalNotice: 1,
          requirements: 1,
          userRequirements: 1,
          reservation_timetable: 1,
          count_reservation_days: 1,
          guide: 1,
          requiredObject: 1,
          objects: 1,
          requirement_filters: 1,
          expired_at: 1,
          createdAt: 1,
          commissionAgreement: 1,
          remaining: { $cond: [{ $eq: ['$status', 'active'] }, { $subtract: [{ $divide: ['$budget', '$reward'] }, { $add: ['$completed', '$reserved'] }] }, 0] },
        },
      },
    ],
  });

  if (error) return { error };
  // eslint-disable-next-line no-return-assign
  const { payable } = await paymentHistory.getPayableHistory(
    { skip: 0, limit: 1, sponsor: data.guideName },
  );
  const user = await hiveClient.execute(
    hiveOperations.getAccountInfo,
    data.guideName,
  );
  const budgetTotal = {
    account_amount: parseFloat(_.get(user, 'balance', 0)),
    sum_payable: payable,
    sum_reserved: _.sumBy(dashboard, (campaign) => {
      if (campaign.reserved) {
        return (campaign.reserved * campaign.reward)
            + (campaign.reserved * campaign.reward) * campaign.commissionAgreement;
      }
      return 0;
    }),
  };
  // if there are reservations, you need to recalculate at the exchange rate to the dollar,
  // ideally this should be done taking into account the rate of each reservation,
  // but for now we take into account the current rate
  if (budgetTotal.sum_reserved) {
    const { usdCurrency } = await currencyRequest.getHiveCurrency();
    budgetTotal.sum_reserved = usdCurrency ? budgetTotal.sum_reserved / usdCurrency : budgetTotal.sum_reserved;
  }
  budgetTotal.remaining = _.round(
    budgetTotal.account_amount - budgetTotal.sum_payable - budgetTotal.sum_reserved, 4,
  );

  _.map(dashboard, (campaign) => {
    // I use rounding here because JS returns very strange numbers in some division cases
    campaign.remaining = _.toInteger(_.ceil(campaign.remaining, 7));
    campaign.payed = _.round(_.sumBy(campaign.users, (usr) => {
      if (usr.status === 'completed') {
        return campaign.reward / usr.hiveCurrency + usr.rewardRaisedBy;
      }
      return 0;
    }), 3);
  });
  const { campaigns, error: addObjectsError } = await addObjectsToCampaigns(dashboard);
  if (error) return { error: addObjectsError };
  return {
    campaigns,
    budget_total: budgetTotal,
  };
};

const guideLookup = () => [{
  $lookup: {
    from: 'users',
    let: { name: '$guideName' },
    pipeline: [
      { $match: { $expr: { $eq: ['$name', '$$name'] } } },
      {
        $project: {
          name: 1, alias: 1, wobjects_weight: 1, _id: 0,
        },
      },
    ],
    as: 'guide',
  },
},
{
  $unwind: { path: '$guide' },
},
];

const addObjectsToCampaigns = async (campaigns) => {
  let objects = [];
  _.forEach(campaigns,
    // eslint-disable-next-line no-return-assign,max-len
    (campaign) => objects = _.uniq(_.concat(objects, campaign.objects, campaign.requiredObject, campaign.agreementObjects)));
  const { result: wobjects, error } = await wobjectModel.aggregate(objectsPipeline(objects));
  if (error) return { error };
  for (const wobject of wobjects) {
    const { objectName } = await wobjectHelper.getWobjectName(wobject.author_permlink);
    wobject.name = objectName;
  }
  campaigns = _.map(campaigns, (campaign) => {
    campaign.agreementObjects = _.filter(wobjects,
      (wobject) => _.includes(campaign.agreementObjects, wobject.author_permlink));
    campaign.objects = _.filter(wobjects,
      (wobject) => _.includes(campaign.objects, wobject.author_permlink));
    campaign.requiredObject = _.find(wobjects,
      (wobject) => campaign.requiredObject === wobject.author_permlink);
    return campaign;
  });
  return { campaigns };
};

const objectsPipeline = (objects) => [
  { $match: { author_permlink: { $in: objects } } },
  { $addFields: { fields: { $filter: { input: '$fields', as: 'field', cond: { $eq: ['$$field.name', 'name'] } } } } },
  {
    $project: {
      _id: 0, author_permlink: 1, fields: 1, object_type: 1,
    },
  },
];
