/* eslint-disable camelcase */
const {
  maxMapRadius, minCountMapCampaigns, PAYMENT_HISTORIES_TYPES, CAMPAIGN_STATUSES,
  RESERVATION_STATUSES, CAMPAIGN_FIELDS_FOR_CARDS, CAMPAIGN_SORTS, CAMPAIGN_PAYMENT_SORTS,
  CAMPAIGN_STATUSES_REWARD_JOB, REWARD_JOB_CURRENCIES, SUPPORTED_CURRENCIES,
} = require('constants/constants');
const {
  campaignModel, userModel, paymentHistoryModel, Subscriptions, wobjectSubscriptions, appModel,
  currenciesRateModel,
} = require('models');
const { CAMPAIGN_FIELDS, STATUSES } = require('constants/wobjectsData');
const blackListHelper = require('utilities/helpers/blackListHelper');
const wobjectHelper = require('utilities/helpers/wobjectHelper');
const jsonHelper = require('utilities/helpers/jsonHelper');
const { divide } = require('utilities/helpers/calcHelper');
const validators = require('controllers/validators');
const { getNamespace } = require('cls-hooked');
const moment = require('moment');
const _ = require('lodash');
const { REMOVE_OBJ_STATUSES } = require('../../constants/wobjectsData');

const sortPrimaryCampaigns = (campaigns, sort) => {
  switch (sort) {
    case CAMPAIGN_SORTS.DATE:
      return _.orderBy(campaigns, ['last_created'], ['desc']);
    case CAMPAIGN_SORTS.PROXIMITY:
      return _.sortBy(campaigns, (campaign) => campaign.distance);
    case CAMPAIGN_SORTS.REWARD:
      return _.orderBy(campaigns, ['max_reward', 'last_created'], ['desc']);
    case CAMPAIGN_SORTS.PAYOUT:
      return _.orderBy(campaigns, ['payout'], ['desc']);
    case CAMPAIGN_SORTS.DEFAULT:
    default:
      return _.orderBy(campaigns, [(campaign) => campaign.distance, 'payout'], ['asc', 'desc']);
  }
};

const getCampaignsForFirstMapLoad = (campaigns, radius = 183500) => {
  if (campaigns.length < minCountMapCampaigns) {
    return {
      campaigns: _.filter(campaigns,
        (campaign) => campaign.distance && campaign.distance < maxMapRadius),
      radius: maxMapRadius,
    };
  }

  const nearCampaigns = _.filter(campaigns,
    (campaign) => campaign.distance && campaign.distance <= radius);
  if (nearCampaigns.length >= minCountMapCampaigns) return { campaigns: nearCampaigns, radius };

  const anotherCampaigns = _.filter(campaigns,
    (campaign) => campaign.distance && campaign.distance >= radius
        && campaign.distance <= maxMapRadius);

  const notEnough = minCountMapCampaigns - nearCampaigns.length < anotherCampaigns.length
    ? minCountMapCampaigns - nearCampaigns.length
    : anotherCampaigns.length;

  for (let counter = 0; counter < notEnough; counter++) {
    nearCampaigns.push(anotherCampaigns[counter]);
  }
  radius = nearCampaigns.length ? nearCampaigns[nearCampaigns.length - 1].distance : maxMapRadius;
  return { campaigns: nearCampaigns, radius };
};

/*
due to the fact that the front sends us the coordinates on the contrary,
always send 1 element that sends the frontend to this method, and
2 coordinates from the database
 */
const getDistance = (first, second) => {
  const EARTH_RADIUS = 6372795;
  const long1 = first[0] * (Math.PI / 180);
  const long2 = second[1] * (Math.PI / 180);
  const lat1 = first[1] * (Math.PI / 180);
  const lat2 = second[0] * (Math.PI / 180);

  const cl1 = Math.cos(lat1);
  const cl2 = Math.cos(lat2);
  const sl1 = Math.sin(lat1);
  const sl2 = Math.sin(lat2);
  const delta = long2 - long1;
  const cdelta = Math.cos(delta);
  const sdelta = Math.sin(delta);

  // eslint-disable-next-line no-restricted-properties
  const y = Math.sqrt(Math.pow(cl2 * sdelta, 2)
      + Math.pow(cl1 * sl2 - sl1 * cl2 * cdelta, 2));
  const x = sl1 * sl2 + cl1 * cl2 * cdelta;

  const ad = Math.atan2(y, x);
  return Math.round(ad * EARTH_RADIUS);
};

const parseCoordinates = (map) => {
  try {
    const coordinates = JSON.parse(map);
    return [coordinates.longitude, coordinates.latitude];
  } catch (error) {
    return null;
  }
};

const fillObjects = (
  campaign, userName, wobjects, obj, radius, area, firstMapLoad = false, guideName = '',
) => {
  let reservation = null, distance = null, reward = null, countUsers = 0;
  if (userName) {
    reservation = _.find(campaign.users,
      (user) => user.name === userName
          && user.object_permlink === obj
          && user.status === 'assigned');

    if (reservation) {
      reward = (campaign.reward / reservation.hiveCurrency)
          + reservation.rewardRaisedBy - (reservation.rewardReducedBy || 0);
    }
  }

  const object = _.find(wobjects, (wobj) => wobj.author_permlink === obj);
  const toDisplay = requireDisplay({
    guideName, campaign, object, userName,
  });
  if (!object || !toDisplay) return null;

  if (_.get(campaign.users, 'length')) {
    countUsers = _.filter(campaign.users,
      (user) => user.status === 'assigned' && user.object_permlink === obj).length;
  }
  if (area && !firstMapLoad) {
    const coordinates = _.get(object, 'map') ? parseCoordinates(object.map) : null;
    distance = coordinates ? getDistance(area, coordinates) : null;
    if (radius && (radius < distance || !_.isNumber(distance))) return;
  }
  return {
    object,
    permlink: _.get(reservation, 'permlink', null),
    author: _.get(reservation, 'rootName', _.get(reservation, 'name', null)),
    count_users: countUsers,
    assigned: !!reservation,
    reward,
    reservationCreated: _.get(reservation, 'createdAt', null),
    distance,
  };
};

// require display to reserved user and sponsor
const requireDisplay = ({
  guideName, campaign, object, userName,
}) => {
  if (!_.includes(['relisted', 'unavailable'], _.get(object, 'status.title'))) return true;
  const isAssigned = _.filter(campaign.users, (user) => user.name === userName && user.status === 'assigned').length;
  return !!(isAssigned || guideName === campaign.guideName);
};

/**
 *
 * @param campaign {Object}
 * @param user {Object | null}
 * @returns {Promise<{can_assign_by_budget: boolean, followers: boolean,
 * can_assign_by_current_day: *, freeReservation: boolean,
 * not_blacklisted: boolean, expertise: boolean, posts: boolean, frequency: boolean}>}
 */
const getRequirementFilters = async (campaign, user) => {
  const currentDay = moment().format('dddd').toLowerCase();
  let lastCompleted = null, daysPassed = null, assignedUser = false;
  if (user) {
    user.wobjects_weight < 0 ? user.wobjects_weight = 0 : null;
    ({ lastCompleted, assignedUser } = await this.getCompletedUsersInSameCampaigns(
      campaign.guideName, campaign.requiredObject, user.name,
    ));
    daysPassed = Math.trunc((new Date().valueOf() - new Date(lastCompleted).valueOf()) / 86400000);
  }
  const {
    result: blackListUsers,
    whiteList,
  } = await blackListHelper.getGuideBlackList(campaign.guideName);
  const thisMonthCompleted = _.filter(campaign.users,
    (payment) => payment.updatedAt > moment.utc().startOf('month') && payment.status === 'completed');
  const assigned = _.filter(campaign.users, (usr) => usr.status === 'assigned');

  return {
    can_assign_by_budget: campaign.budget > (thisMonthCompleted.length + assigned.length) * campaign.rewardInCurrency,
    can_assign_by_current_day: campaign.reservation_timetable[currentDay],
    posts: user ? user.count_posts >= _.get(campaign, 'userRequirements.minPosts', 0) : false,
    followers: user ? user.followers_count >= _.get(campaign, 'userRequirements.minFollowers', 0) : false,
    expertise: user ? user.wobjects_weight >= _.get(campaign, 'userRequirements.minExpertise', 0) : false,
    freeReservation: user ? !_.find(campaign.users, (usr) => usr.name === user.name && usr.status === 'assigned') : true,
    frequency: _.isNumber(daysPassed) ? daysPassed >= campaign.frequency_assign : true,
    not_blacklisted: user ? !_.includes(_.difference(blackListUsers, whiteList), user.name) : true,
    not_same_assigns: !assignedUser,
  };
};

const getGuideInfo = async (guideName, users, currentUser) => {
  let youFollows;
  const { result: payments } = await paymentHistoryModel.find({ sponsor: guideName });
  const transfers = _.filter(payments,
    (payment) => payment.type === PAYMENT_HISTORIES_TYPES.TRANSFER);
  const totalPayedVote = _.sumBy(payments, 'details.votesAmount');
  let totalPayed = _.sumBy(transfers, 'amount');
  if (totalPayedVote) totalPayed += totalPayedVote;

  const guide = _.find(users, (user) => user.name === guideName);
  if (currentUser) {
    const { users: followArray } = await Subscriptions
      .getFollowings({ follower: currentUser.name });
    youFollows = followArray.includes(guideName);
  } else youFollows = false;

  return {
    youFollows,
    totalPayed,
    liquidHivePercent: totalPayedVote ? 100 - Math.round((totalPayedVote / totalPayed) * 100) : 100,
    ..._.pick(guide, ['name', 'wobjects_weight', 'alias']),
  };
};

exports.getCampaigns = async ({ matchData }) => {
  const { result: campaigns } = await campaignModel.aggregate(matchData);
  return { campaigns };
};

exports.getPrimaryCampaigns = async ({
  allCampaigns, guideNames, skip, limit, area, sort, userName,
  reserved, simplified, firstMapLoad, radius, appName, locale,
}) => {
  let campaigns = [], currentUser, sponsors = [];
  const { wobjects } = await wobjectHelper.getWobjects({
    campaigns: allCampaigns, forSecondary: false, appName, locale,
  });

  if (_.includes(CAMPAIGN_PAYMENT_SORTS, sort)) {
    for (const campaign of allCampaigns) {
      campaign.payout = amountPayments(campaign);
    }
  }
  const groupedCampaigns = _.groupBy(allCampaigns, 'requiredObject');
  await Promise.all(Object.keys(groupedCampaigns).map(async (key) => {
    let requiredObject = _.find(wobjects, (obj) => obj.author_permlink === key);
    if (!requiredObject) return;
    const objStatus = _.get(requiredObject, 'status.title', null);

    if (userName) {
      ({ user: currentUser } = await userModel.findOne(userName));
    }
    if (!reserved && ((!_.get(currentUser, 'user_metadata.settings.showNSFWPosts', true) && objStatus === 'nsfw'))) return;

    if (simplified && requiredObject) {
      requiredObject.fields = _.filter(requiredObject.fields, (field) => field.name === 'name' || field.name === 'avatar');
      requiredObject = _.pick(requiredObject, ['author_permlink', 'map', 'weight', 'status', 'name', 'default_name', 'avatar']);
    }

    sponsors = _.uniq(_.concat(sponsors, _.map(groupedCampaigns[key], 'guideName')));
    if (guideNames) {
      groupedCampaigns[key] = _.filter(groupedCampaigns[key],
        (campaign) => _.includes(guideNames, campaign.guideName));
      if (!groupedCampaigns[key].length) return;
    }
    const coordinates = _.compact(parseCoordinates(requiredObject.map)) || [];
    campaigns.push({
      last_created: _.maxBy(groupedCampaigns[key], (campaign) => campaign.createdAt).createdAt,
      min_reward: _.minBy(groupedCampaigns[key], (campaign) => campaign.reward).reward,
      max_reward: _.maxBy(groupedCampaigns[key], (campaign) => campaign.reward).reward,
      distance: area && coordinates.length === 2 ? getDistance(area, coordinates) : null,
      count: groupedCampaigns[key].length,
      required_object: requiredObject,
      payout: primaryCampaignsPayout(groupedCampaigns[key], sort),
    });
  }));
  campaigns = sortPrimaryCampaigns(campaigns, firstMapLoad ? CAMPAIGN_SORTS.PROXIMITY : sort);

  if (firstMapLoad) {
    ({ campaigns, radius } = getCampaignsForFirstMapLoad(campaigns, radius));
  } else if (area && radius && !firstMapLoad) {
    campaigns = _.filter(campaigns,
      (campaign) => campaign.distance && campaign.distance < radius);
  }
  return {
    campaigns: firstMapLoad ? campaigns : campaigns.slice(skip, skip + limit),
    hasMore: firstMapLoad ? false : campaigns.slice(0, limit + skip).length < campaigns.length,
    sponsors,
    campaigns_types: _.uniq(_.map(allCampaigns, 'type')),
    radius,
  };
};

exports.getSecondaryCampaigns = async ({
  allCampaigns, skip, limit, userName, eligible, reserved, needProcess = true,
  radius, area, sort = CAMPAIGN_SORTS.REWARD, firstMapLoad, guideNames, guideName, appName, locale,
}) => {
  let campaigns = [], currentUser, wobjectsFollow = [];
  const { wobjects } = await wobjectHelper.getWobjects({
    campaigns: allCampaigns, needProcess, appName, locale,
  });
  const { users } = await userModel.findByNames(_.concat(_.map(allCampaigns, 'guideName'), userName));
  if (userName) {
    currentUser = _.find(users, (user) => user.name === userName);
    if (currentUser) {
      ({ wobjects: wobjectsFollow } = await wobjectSubscriptions
        .getFollowings({ follower: _.get(currentUser, 'name', '') }));
    }
  }

  await Promise.all(allCampaigns.map(async (campaign) => {
    if (needProcess) {
      campaign.objects = _.compact(_.map(campaign.objects,
        (obj) => fillObjects(campaign, userName, wobjects, obj, radius, area, firstMapLoad, guideName)));
      campaign.guide = await getGuideInfo(campaign.guideName, users, currentUser);
    }
    if (!campaign.objects.length) return;
    campaign.required_object = _.find(wobjects,
      (obj) => obj.author_permlink === campaign.requiredObject);
    if (campaign.required_object && currentUser) {
      campaign.required_object.followsObject = wobjectsFollow
        .includes(campaign.requiredObject);
    }

    if (sort === CAMPAIGN_SORTS.PAYOUT) campaign.payout = amountPayments(campaign);
    const objStatus = _.get(campaign, 'required_object.status.title', null);
    if (!reserved && (_.includes(REMOVE_OBJ_STATUSES, objStatus))) return;
    if ((!_.get(currentUser, 'user_metadata.settings.showNSFWPosts', true) && objStatus === STATUSES.NSFW)) return;
    campaign.requirement_filters = await getRequirementFilters(
      campaign, _.find(users, (usr) => usr.name === userName),
    );
    if (eligible && _.every(Object.values(campaign.requirement_filters))) campaigns.push(campaign);
    else if (!eligible) campaigns.push(campaign);
  }));

  // sorting stage, by default sort = reward
  // campaigns = sortPrimaryCampaigns(campaigns, sort);
  if (sort === CAMPAIGN_SORTS.REWARD) campaigns = _.orderBy(campaigns, ['reward'], ['desc']);
  if (sort === CAMPAIGN_SORTS.DATE) campaigns = _.orderBy(campaigns, ['expired_at'], ['desc']);
  if (sort === CAMPAIGN_SORTS.PAYOUT) campaigns = _.orderBy(campaigns, ['payout'], ['desc']);

  const eligibleCampaigns = guideNames ? _.filter(campaigns,
    (campaign) => _.includes(guideNames, campaign.guideName)) : campaigns;
  return {
    campaigns: eligibleCampaigns,
    hasMore: eligibleCampaigns.slice(0, limit + skip).length < eligibleCampaigns.length,
    sponsors: _.uniq(_.map(campaigns, 'guideName')),
    campaigns_types: _.uniq(_.map(allCampaigns, 'type')),
  };
};

exports.getCompletedUsersInSameCampaigns = async (guideName, requiredObject, userName) => {
  const pipeline = [{
    $match: {
      guideName, requiredObject, status: { $nin: ['pending'] }, 'users.name': userName, 'users.status': { $in: ['completed', 'assigned'] },
    },
  }, {
    $addFields: {
      completedUser: {
        $filter: { input: '$users', as: 'user', cond: { $and: [{ $eq: ['$$user.name', userName] }, { $eq: ['$$user.status', 'completed'] }] } },
      },
      assignedUser: { $filter: { input: '$users', as: 'user', cond: { $and: [{ $eq: ['$$user.name', userName] }, { $eq: ['$$user.status', 'assigned'] }] } } },
    },
  },
  { $project: { _id: null, completedUser: 1, assignedUser: 1 } },
  ];
  const { result } = await campaignModel.aggregate(pipeline);
  if (_.isEmpty(result)) return { lastCompleted: null, assignedUser: false };
  return { lastCompleted: _.max(_.map(result[0].completedUser, 'updatedAt')) || null, assignedUser: !!_.last(_.get(result, '[0].assignedUser')) };
};

exports.campaignsAggregation = async ({
  status, requiredObject, primaryObject, types,
}) => {
  const matchData = [{ $match: { status: { $in: status } } }];
  if (requiredObject) matchData[0].$match.requiredObject = requiredObject;
  if (primaryObject) matchData[0].$match.requiredObject = primaryObject;
  if (types) matchData[0].$match.type = { $in: types };
  return this.getCampaigns({ matchData });
};

exports.checkCampaignsBudget = (campaigns, userName) => _.filter(campaigns,
  (campaign) => {
    if (_.find(campaign.users, (usr) => usr.status === 'assigned' && usr.name === userName)) {
      return campaign;
    }
    if (campaign.budget > campaign.reward * _.filter(campaign.users, (usr) => usr.status === 'assigned'
        || (usr.status === 'completed' && usr.updatedAt > moment.utc().startOf('month'))).length) {
      return campaign;
    }
  });

exports.eligibleCampaignsFilter = (campaigns, userName) => _.filter(campaigns,
  (campaign) => campaign.budget > campaign.rewardInCurrency
    * _.filter(campaign.users, (usr) => usr.status === 'assigned' || (usr.status === 'completed' && usr.updatedAt > moment.utc().startOf('month'))).length
    && !_.find(campaign.users, (user) => user.name === userName && user.status === 'assigned'));

exports.checkOnHoldStatus = async (permlink) => {
  const { result: campaign } = await campaignModel
    .findOne({ activation_permlink: permlink, status: CAMPAIGN_STATUSES.ON_HOLD });
  if (!campaign) return;
  const hasAssignedUsers = _
    .filter(campaign.users, (u) => u.status === RESERVATION_STATUSES.ASSIGNED);
  if (_.isEmpty(hasAssignedUsers)) {
    await campaignModel.updateOne({ _id: campaign._id }, { status: CAMPAIGN_STATUSES.INACTIVE });
  }
};

exports.processCampaignsByWobject = async ({
  campaigns, wobject, userName, locale,
}) => {
  const resultArray = [];
  const { result: app } = await appModel.findOne(getNamespace('request-session').get('host'));
  const object = await wobjectHelper.processWobjects({
    wobjects: [wobject], fields: CAMPAIGN_FIELDS, app, returnArray: false, locale,
  });
  const { users } = await userModel.findByNames(_.concat(_.map(campaigns, 'guideName'), userName));
  const currentUser = _.find(users, (user) => user.name === userName);

  for (const campaign of campaigns) {
    campaign.object = object;
    campaign.guide = await getGuideInfo(campaign.guideName, users, currentUser);
    campaign.requirement_filters = await getRequirementFilters(campaign, currentUser);
    if (!currentUser || _.every(Object.values(campaign.requirement_filters))) {
      resultArray.push(_.pick(campaign, CAMPAIGN_FIELDS_FOR_CARDS));
    }
  }

  return _.reduce(resultArray, (acc, el) => {
    el.requiredObject === wobject.author_permlink
      ? acc.campaigns.push(el)
      : acc.propositions.push(el);
    return acc;
  }, { campaigns: [], propositions: [] });
};

const amountPayments = (campaign) => {
  const countPayments = _.filter(_.get(campaign, 'payments', []),
    (payment) => (payment.status !== 'rejected')).length;
  return countPayments
    ? (countPayments * campaign.reward * campaign.commissionAgreement)
    : (campaign.reward * campaign.commissionAgreement);
};

const primaryCampaignsPayout = (campaigns, sort) => (_.includes(CAMPAIGN_PAYMENT_SORTS, sort)
  ? _.sumBy(campaigns, (campaign) => campaign.payout) / campaigns.length
  : 0);

exports.rewardConvertJob = async () => {
  const { campaigns } = await campaignModel.find(
    {
      status: { $in: CAMPAIGN_STATUSES_REWARD_JOB },
      currency: { $in: REWARD_JOB_CURRENCIES },
    },
    {},
    { currency: 1, rewardInCurrency: 1 },
  );
  if (_.isEmpty(campaigns)) return;

  const { result } = await currenciesRateModel.findOne({
    condition: { base: SUPPORTED_CURRENCIES.USD },
    sort: { dateString: -1 },
  });

  for (const campaign of campaigns) {
    const reward = divide(campaign.rewardInCurrency, _.get(result, `rates.${campaign.currency}`));
    await campaignModel.updateOne({ _id: campaign._id }, { $set: { reward } });
  }
};

exports.deleteSponsorObligationsHelper = async ({ campaignId, reservation_permlink }) => {
  const { result } = await campaignModel.findOne({ _id: campaignId });
  if (!result) return false;
  const user = _.find(
    result.users,
    (u) => u.status === RESERVATION_STATUSES.COMPLETED && u.permlink === reservation_permlink,
  );
  if (!user) return false;
  await campaignModel.updateOne(
    { _id: campaignId, users: { $elemMatch: { permlink: reservation_permlink } } },
    {
      $set: { 'users.$.status': RESERVATION_STATUSES.ASSIGNED },
      $unset: {
        'users.$.completedAt': 1,
        'users.$.fraudSuspicion': 1,
        'users.$.fraudCodes': 1,
      },
    },
  );
  await paymentHistoryModel.deleteMany({
    'details.reservation_permlink': reservation_permlink,
    sponsor: result.guideName,
  });
  return true;
};
