const paymentHistory = require('utilities/operations/paymentHistory');
const { hiveOperations } = require('utilities/hiveApi');
const { SUPPORTED_CURRENCIES } = require('constants/constants');
const { divide } = require('utilities/helpers/calcHelper');
const { currencyRequest } = require('utilities/requests');
const { campaignHelper } = require('utilities/helpers');
const { currenciesRateModel } = require('models');
const moment = require('moment');
const _ = require('lodash');

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
          budget: 1, // need decimal128
          reward: 1, // need decimal128
          reserved: 1, // ? need decimal128
          completed: 1, // ? need decimal128
          completedTotal: 1,
          agreementObjects: 1,
          requiredObject: { author_permlink: '$requiredObject' },
          requirements: 1,
          userRequirements: 1,
          expired_at: 1,
          createdAt: 1,
          guide: 1,
          currency: 1,
          rewardInCurrency: 1,
          commissionAgreement: 1, // ? need decimal128
          remaining: { $cond: [{ $eq: ['$status', 'active'] }, { $subtract: [{ $divide: ['$budget', '$rewardInCurrency'] }, { $add: ['$completed', '$reserved'] }] }, 0] },
        },
      },
    ],
  });

  if (error) return { error };

  const { result: currencyRate } = await currenciesRateModel.findOne({
    condition: { base: SUPPORTED_CURRENCIES.USD },
    sort: { dateString: -1 },
  });

  for (const item of dashboard) {
    item.budgetUSD = item.currency === SUPPORTED_CURRENCIES.USD
      ? item.budget
      : divide(item.budget, _.get(currencyRate, `rates.${item.currency}`), 4);
  }

  const { payable } = await paymentHistory.getPayableHistory({
    skip: 0, limit: 1, sponsor: data.guideName,
  });
  const user = await hiveOperations.getAccountInfo(data.guideName);
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
    budgetTotal.sum_reserved = usdCurrency
      ? budgetTotal.sum_reserved / usdCurrency
      : budgetTotal.sum_reserved;
  }
  budgetTotal.remaining = _.round(
    budgetTotal.account_amount - budgetTotal.sum_payable - budgetTotal.sum_reserved, 4,
  );
  const campaigns = calcPayedRemaining(dashboard);

  return {
    campaigns,
    budget_total: budgetTotal,
  };
};

const calcPayedRemaining = (dashboard) => _.map(dashboard, (campaign) => {
  // I use rounding here because JS returns very strange numbers in some division cases
  campaign.remaining = _.toInteger(_.ceil(campaign.remaining, 7));
  campaign.payed = _.round(_.sumBy(campaign.users, (usr) => {
    if (usr.status === 'completed') {
      return campaign.reward / usr.hiveCurrency + usr.rewardRaisedBy;
    }
    return 0;
  }), 3);
  return campaign;
});

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
