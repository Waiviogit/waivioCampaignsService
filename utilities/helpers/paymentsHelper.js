const moment = require('moment');
const _ = require('lodash');
const { Campaign, MatchBot, User } = require('database').models;
const PaymentHistory = require('models/paymentHistoryModel');
const BotUpvote = require('models/botUpvoteModel');
const appModel = require('models/appModel');
const CampaignModel = require('models/campaignModel');
const wobjectModel = require('models/wobjectModel');
const currenciesRateModel = require('models/currenciesRateModel');
const { redisSetter, redisGetter } = require('utilities/redis');
const currencyRequest = require('utilities/requests/currencyRequest');
const { RECALCULATION_DEBT, SUSPENDED_WARNING, PAYMENT_DEBT } = require('constants/ttlData');
const {
  REFERRAL_TYPES, GUEST_BNF_ACC, CAMPAIGN_STATUSES, SUPPORTED_CURRENCIES,
} = require('constants/constants');
const { detectFraudInReview } = require('utilities/helpers/detectFraudHelper');
const { checkOnHoldStatus } = require('utilities/helpers/campaignsHelper');
const {
  divide, multiply, add, sumBy, subtract,
} = require('utilities/helpers/calcHelper');

/**
 * Initially, all records about the sponsor's debts are generated,
 * if a bot is connected in the campaign, a record is created for the
 * bot to take actions, the reservation of isere is marked as completed,
 * and all records about the sponsor's debts are created
 * @param campaigns {Object}
 * @param owner_account {string | undefined}
 * @param beneficiaries
 * @param objects
 * @param permlink
 * @param title
 * @param app
 * @returns {Promise<void>}
 */
const createReview = async ({
  campaigns, owner_account: owner, beneficiaries,
  objects, permlink, title, app, images, host,
}) => {
  for (const campaign of campaigns) {
    const rewardInHive = await getRewardInHive(campaign);
    const { payables } = await distributeReward({
      server_acc: campaign.campaign_server,
      beneficiaries,
      reward: rewardInHive,
      reviwer: campaign.userName,
      commission: campaign.commissionAgreement,
      isGuest: !!owner,
      host,
    });
    const objectPermlink = _.find(objects, (object) => campaign.userReservationObject === object);
    if (_.isEmpty(objectPermlink)) return;
    if (!_.isEmpty(campaign.match_bots)) {
      await executeMatchBots({
        campaign, permlink, owner, rewardInHive,
      });
    }
    if (title) {
      await addCampaignPayment({
        campaign, postTitle: title, objectPermlink, permlink, owner, reservationId: campaign.user_id,
      });
      const { fraud, fraudCodes } = await detectFraudInReview(images, campaign);
      await CampaignModel.updateUserStatus({
        campaign_id: campaign.campaignId, user_id: campaign.user_id, status: 'completed', fraud, fraudCodes,
      });
      await updateCampaignStatus(campaign.campaignId);
      await checkOnHoldStatus(campaign.permlink);
    }
    for (const payable of payables) {
      let debt = 0;
      const { result: transfer } = await PaymentHistory.findOne({
        sponsor: campaign.guideName, userName: payable.account, type: 'transfer', payed: false,
      });
      if (transfer && transfer.details.remaining && transfer.details.remaining - payable.amount >= -0.001) {
        await PaymentHistory.updateOne({ _id: transfer._id }, {
          'details.remaining': 0,
          payed: true,
        });
        debt = transfer.details.remaining;
      }
      const updBeneficiaries = _.chain(payables).filter({ type: 'beneficiary_fee' }).map((bnf) => ({ account: bnf.account, weight: bnf.weight })).value();
      const { payment } = await PaymentHistory.addPaymentHistory({
        userReservationPermlink: campaign.userReservationPermlink,
        hiveCurrency: campaign.hiveCurrency,
        requiredObject: campaign.requiredObject,
        userName: payable.account,
        sponsor: campaign.guideName,
        type: payable.type,
        payed: !(payable.amount - debt > 0.001),
        commission: payable.commission || null,
        payable: _.round(payable.amount, 3),
        review_permlink: permlink,
        beneficiaries: updBeneficiaries,
        object_permlink: objectPermlink,
        owner_account: owner,
        app,
      });
      if (payment) {
        await redisSetter.saveTTL(`expire:${PAYMENT_DEBT}|${payment._id.toString()}`, 2592000, campaign.campaignId.toString());
      }
    }
    await redisSetter.saveTTL(`expire:${SUSPENDED_WARNING}|${campaign.userReservationPermlink}|5`, 2160000, campaign.campaignId.toString());
  }
};

const getRewardInHive = async ({
  rewardInCurrency, hiveCurrency, currency, rewardRaisedBy = 0,
}) => {
  const hiveReward = {
    [SUPPORTED_CURRENCIES.USD]: () => add(
      divide(rewardInCurrency, hiveCurrency, 3),
      rewardRaisedBy,
    ),
    getRewardFromCurrencies: () => doubleCastReward({
      currency, rewardInCurrency, hiveCurrency, rewardRaisedBy,
    }),
  };
  return (hiveReward[currency] || hiveReward.getRewardFromCurrencies)();
};

const doubleCastReward = async ({
  currency, rewardInCurrency, hiveCurrency, rewardRaisedBy = 0,
}) => {
  const { result: latest } = await currenciesRateModel.findOne({
    condition: { base: SUPPORTED_CURRENCIES.USD },
    select: { [`rates.${currency}`]: 1 },
    sort: { dateString: -1 },
  });
  return add(
    divide(divide(rewardInCurrency, _.get(latest, `rates.${currency}`)), hiveCurrency, 3),
    rewardRaisedBy,
  );
};

const updateCampaignStatus = async (campaignId) => {
  const { result: campaign } = await CampaignModel.findOne({ _id: campaignId });
  if (!campaign) return;
  const thisMonthCompletedUsers = _.filter(campaign.users, (payment) => payment.updatedAt > moment.utc().startOf('month') && payment.status === 'completed');
  if (campaign.budget <= campaign.rewardInCurrency * thisMonthCompletedUsers.length
      || campaign.budget - (campaign.rewardInCurrency * thisMonthCompletedUsers.length) < campaign.rewardInCurrency) {
    await CampaignModel.updateOne({ _id: campaignId }, { status: CAMPAIGN_STATUSES.REACHED_LIMIT });
    await wobjectModel.updateCampaignsCount({
      wobjPermlinks: [campaign.requiredObject, ...campaign.objects],
      status: CAMPAIGN_STATUSES.REACHED_LIMIT,
      id: campaignId,
    });
  }
};

/**
 * Aggregate campaigns for find active reservations from
 * current user in campaigns with required objects from params
 * @param userName {string}
 * @param objects {[string]}
 * @returns {Promise<Aggregate>}
 */
const findReviewCampaigns = async ({ userName, objects }) => Campaign.aggregate([
  { $unwind: '$users' },
  {
    $match: {
      'users.object_permlink': { $in: objects },
      'users.name': userName,
      'users.status': 'assigned',
    },
  }, {
    $project: {
      user_id: '$users._id',
      userName: '$users.name',
      hiveCurrency: '$users.hiveCurrency',
      rewardRaisedBy: '$users.rewardRaisedBy',
      guideName: '$guideName',
      campaign_server: '$app',
      referral_server: '$users.referral_server',
      requiredObject: '$requiredObject',
      userStatus: '$users.status',
      userReservationObject: '$users.object_permlink',
      userReservationPermlink: '$users.permlink',
      campaignUserId: '$users.id',
      campaignId: '$_id',
      reward: '$reward',
      match_bots: '$match_bots',
      commissionAgreement: '$commissionAgreement',
      userRequirements: '$userRequirements',
      requirements: '$requirements',
      reservedAt: '$users.createdAt',
      permlink: '$activation_permlink',
      currency: '$currency',
      rewardInCurrency: '$rewardInCurrency',
      _id: 0,
      type: 1,
    },
  },
]);

const transfer = async ({
  userName, sponsor, app, amount, permlink, remaining, payed,
}) => {
  amount = parseFloat(amount.match(/.\d*.\d*/)[0]);
  const { result } = await PaymentHistory.find({ sponsor, userName });
  const record = _.find(result, (doc) => _.isString(_.get(doc, 'details.transactionId')));
  if (record) {
    return updatePayment({
      amount, remaining, payed, record,
    });
  }
  return PaymentHistory.addPaymentHistory({
    userName, sponsor, app, type: 'transfer', payable: amount, transfer_permlink: permlink, remaining, payed,
  });
};

const updatePayment = async ({
  amount, record, payed, remaining,
}) => {
  const { usdCurrency } = await currencyRequest.getHiveCurrency();
  return PaymentHistory.updateOne({ _id: record._id }, {
    payableInDollars: usdCurrency * amount,
    amount,
    payed,
    'details.remaining': remaining,
    $unset: { 'details.transactionId': 1 },
  });
};

/**
 * Push record of payment to campaign record
 * (it will be need in future calculations of the campaign’s free budget)
 * @param campaign {Object}
 * @param postTitle {string}
 * @param object_permlink {string}
 * @param permlink {string}
 * @param app {string}
 * @param reservationId
 * @returns {Promise<void>}
 */
const addCampaignPayment = async ({
  campaign, postTitle, objectPermlink, permlink, app, owner, reservationId,
}) => {
  await Campaign.updateOne({ _id: campaign.campaignId }, {
    $push: {
      payments: {
        reservationId,
        status: 'active',
        userName: campaign.userName,
        postTitle,
        objectPermlink,
        postPermlink: permlink,
        app,
        rootAuthor: owner || campaign.userName,
      },
    },
  });
};

/**
 * Create records of debt to the contractor, beneficiaries and apps
 * @param server_acc {string}
 * @param reward {number}
 * @param commission {number}
 * @param reviwer {string}
 * @param beneficiaries {[Object]}
 * @param isGuest
 * @param host {string}
 * @returns {Promise<{payables: []}>}
 */
const distributeReward = async ({
  // eslint-disable-next-line camelcase
  server_acc, reward, commission, reviwer, beneficiaries, isGuest, host,
}) => {
  let payables = [];
  const user = await User.findOne({ name: reviwer }).lean();
  if (isGuest) {
    if (!_.get(user, 'user_metadata.settings.hiveBeneficiaryAccount')) {
      beneficiaries = _.filter(beneficiaries, (el) => el.account !== GUEST_BNF_ACC);
    }
  }
  const beneficiariesData = _.map(beneficiaries,
    (bnf) => ({
      account: bnf.account,
      amount: multiply(divide(bnf.weight, 10000), reward, 4),
      weight: bnf.weight,
    }));

  const reviewReward = subtract(reward, sumBy(beneficiariesData, (el) => el.amount));
  payables.push({ account: reviwer, amount: reviewReward, type: 'review' });

  const referralAcc = _.find(_.get(user, 'referral'),
    (referral) => referral.type === REFERRAL_TYPES.REWARDS);
  const referralAgent = referralAcc && referralAcc.endedAt > new Date() ? referralAcc.agent : null;

  const commissionPayments = await commissionRecords(reward, commission, server_acc, referralAgent, host);
  payables = _.concat(payables, commissionPayments);

  for (const bnf of beneficiariesData) {
    payables.push({
      account: bnf.account, amount: bnf.amount, weight: bnf.weight, type: 'beneficiary_fee',
    });
  }
  return { payables };
};

/**
 * Find enable match bot and create record for upvote with bot in database if bot exist
 * @param campaign {Object}
 * @param permlink {string}
 * @param rewardInHive{Number}
 * @param owner
 * @returns {Promise<void>}
 */
const executeMatchBots = async ({
  campaign, permlink, owner, rewardInHive,
}) => {
  for (const matchBot of campaign.match_bots) {
    const bot = await MatchBot.findOne(
      { 'sponsors.sponsor_name': campaign.guideName, bot_name: matchBot, 'sponsors.enabled': true },
    ).lean();
    if (bot) {
      const { result } = await redisGetter.getTTLData(`expire:${RECALCULATION_DEBT}|${owner || campaign.userName}|${permlink}`);
      if (!result) await redisSetter.saveTTL(`expire:${RECALCULATION_DEBT}|${owner || campaign.userName}|${permlink}`, 605000);
      const sponsorsPermissions = _.find(
        bot.sponsors,
        (sponsor) => sponsor.sponsor_name === campaign.guideName,
      );
      const reward = multiply(rewardInHive, 2, 3);
      await BotUpvote.create({
        requiredObject: campaign.requiredObject,
        reservationPermlink: campaign.userReservationPermlink,
        botName: bot.bot_name,
        author: owner || campaign.userName,
        amountToVote: multiply(reward, sponsorsPermissions.voting_percent),
        sponsor: campaign.guideName,
        permlink,
        reward,
      });
    }
  }
};

// eslint-disable-next-line camelcase
const commissionRecords = async (reward, commission, server_acc, referralAgent, host) => {
  const payables = [];

  const { commissions } = await getCommissions(server_acc, host);
  const campaignCommission = multiply(
    multiply(reward, commission),
    commissions.campaignsCommission,
    3,
  );

  if (campaignCommission > 0) {
    payables.push({
      account: commissions.campaignsAccount,
      amount: campaignCommission,
      type: 'campaign_server_fee',
      commission: multiply(divide(campaignCommission, reward), 10000, 4),
    });
  }

  const indexCommission = multiply(
    subtract(multiply(reward, commission), campaignCommission),
    commissions.indexCommission,
    3,
  );

  if (indexCommission > 0) {
    payables.push({
      account: commissions.indexAccount,
      amount: indexCommission,
      type: 'index_fee',
      commission: multiply(
        divide(indexCommission, reward),
        10000,
        4,
      ),
    });
  }

  if (add(campaignCommission, indexCommission) === multiply(reward, commission)) return payables;

  const referralCommission = subtract(
    subtract(multiply(reward, commission, 3), campaignCommission),
    indexCommission,
  );

  payables.push({
    account: referralAgent || commissions.referralAccount,
    amount: referralCommission,
    type: 'referral_server_fee',
    commission: multiply(divide(referralCommission, reward), 10000, 4),
  });

  return payables;
};

const getCommissions = async (appHost, referralHost) => {
  const { result } = await appModel.findOne(appHost);
  const { result: refApp } = await appModel.findOne(referralHost);
  const commissions = {
    indexCommission: _.get(result, 'app_commissions.index_percent', 0.2),
    indexAccount: _.get(result, 'app_commissions.index_commission_acc', 'waivio.index'),
    campaignsCommission: _.get(result, 'app_commissions.campaigns_percent', 0.3),
    campaignsAccount: _.get(result, 'app_commissions.campaigns_server_acc', 'waivio.campaigns'),
    referralAccount:
      _.get(refApp, 'app_commissions.referral_commission_acc',
        _.get(refApp, 'owner',
          _.get(result, 'app_commissions.referral_commission_acc', 'waivio.referrals'))),
  };
  return { commissions };
};

const getRewardUSD = async ({ reward, currency }) => {
  if (currency === SUPPORTED_CURRENCIES.USD) return reward;
  const { result } = await currenciesRateModel.findOne({
    condition: { base: SUPPORTED_CURRENCIES.USD },
    select: { [`rates.${currency}`]: 1 },
    sort: { dateString: -1 },
  });
  return divide(reward, _.get(result, `rates.${currency}`));
};

module.exports = {
  findReviewCampaigns,
  addCampaignPayment,
  updatePayment,
  getRewardUSD,
  createReview,
  transfer,
};
