const _ = require('lodash');
const paymentHistoryModel = require('models/paymentHistoryModel');
const userModel = require('models/userModel');
const { campaignHelper } = require('utilities/helpers');
const steemHelper = require('utilities/helpers/steemHelper');
const currenciesStatisticModel = require('models/currenciesStatisticModel');
const appModel = require('models/appModel');
const config = require('config');

const getMatchData = ({
  onlyWithMessages, fraudSuspicion, guideNames, guideName, userName,
  rewards, status, limit, skip, sort, reservationPermlink,
}) => {
  const pipeline = [
    { $unwind: '$users' },
    { $match: { status: { $in: status }, 'users.status': { $in: rewards } } },
  ];
  if (reservationPermlink) pipeline[1].$match['users.permlink'] = reservationPermlink;
  if (fraudSuspicion) pipeline[1].$match['users.fraudSuspicion'] = true;
  if (guideName) pipeline[1].$match.guideName = guideName;
  if (userName) pipeline[1].$match['users.name'] = userName;
  if (guideNames) pipeline[1].$match.guideName = { $in: guideNames };
  if (!onlyWithMessages) {
    pipeline.push({ $sort: sort === 'reservation' ? { 'users.createdAt': -1 } : { 'users.updatedAt': -1 } });
    pipeline.push({ $skip: skip });
    pipeline.push({ $limit: limit });
  } else pipeline[1].$match['users.children'] = { $gt: 0 };
  return pipeline;
};

/** In this method we get conversations by user campaign reservation,
 * and fill conversations by some keys, like lastReply, firstAppeal etc. */
const getConversationsFromHive = async (campaigns) => {
  const { result: { service_bots = [] } } = await appModel.findOne(config.appHost);
  const botsArray = _.compact(_.map(service_bots, (bot) => {
    if (_.includes(bot.roles, 'proxyBot')) return bot.name;
  }));
  const conversations = await Promise.all(campaigns.map(async (campaign) => {
    const { users } = campaign;
    if (users.children === 0) return;

    const { result: comments } = await steemHelper.getPostState(
      { author: users.rootName, permlink: users.permlink, category: 'waivio' },
    );
    if (!comments.content) return;
    let time = 0, replyTime = 0, firstAppealTime = Number.MAX_SAFE_INTEGER;
    let firstAppeal, lastCreated, reply;

    for (const key of Object.keys(comments.content)) {
      comments.content[key].created = new Date(comments.content[key].created).valueOf();
      const { created } = comments.content[key];

      if (!_.includes([campaign.guideName, users.rootName, ...botsArray], key.split('/')[0])) return;

      if (key !== `${users.name}/${users.permlink}` && comments.content[key].depth === 3 && created > time) {
        time = created;
        lastCreated = key;
        if (created < firstAppealTime && comments.content[key].author === users.name) {
          firstAppealTime = comments.content[key].created;
          firstAppeal = key;
        }
      }

      if (created > replyTime) {
        replyTime = created;
        reply = key;
      }
    }
    return {
      lastCreatedComment: comments.content[lastCreated],
      lastReply: comments.content[reply],
      firstAppeal: comments.content[firstAppeal],
      all: comments.content,
    };
  }));
  return { conversations: _.compact(conversations) };
};

const sortCampaignsHistory = (campaigns, sort, caseStatus) => {
  let filteredCampaigns = [];
  switch (caseStatus) {
    case 'open':
    case 'close':
      _.filter(campaigns, (campaign) => {
        const { conversation, users } = campaign;
        const nameForCheck = caseStatus === 'close' ? campaign.guideName : _.get(users, '[0].name', null);
        if (conversation && conversation.lastReply.author === nameForCheck) {
          filteredCampaigns.push(campaign);
        }
      });
      break;
    default:
      filteredCampaigns = campaigns;
      break;
  }
  switch (sort) {
    case 'inquiryDate':
      return _.orderBy(filteredCampaigns,
        [(campaign) => _.get(campaign, 'conversation.firstAppeal.created', 0), 'users[0].createdAt'], ['desc', 'desc']);
    case 'latest':
      return _.orderBy(filteredCampaigns,
        [(campaign) => _.get(campaign, 'conversation.lastReply.created', 0), 'users[0].createdAt'], ['desc', 'desc']);
    case 'reservation':
      return _.orderBy(filteredCampaigns, ['users[0].createdAt'], ['desc']);
    case 'lastAction':
      return _.orderBy(filteredCampaigns, ['users[0].updatedAt'], ['desc']);
  }
  return filteredCampaigns;
};

const fillCampaign = async (campaign, conversations) => {
  campaign.objects = _.filter(campaign.objects,
    (object) => object === campaign.users.object_permlink);

  const conversation = _.find(conversations,
    (data) => _.get(data, 'lastCreatedComment.parent_permlink') === campaign.users.permlink);
  if (conversation) campaign.conversation = conversation;

  /** if user complete campaign, we need to find hix review permlink for
   * this we get a record of the debt to him and take permlink from there,
   * if debt not found - get reservation permlink
   */
  if (campaign.users.status === 'completed') {
    const { result } = await paymentHistoryModel.findOne(
      { type: 'review', userName: campaign.users.name, 'details.reservation_permlink': campaign.users.permlink },
    );
    campaign.users.review_permlink = result ? _.get(result, 'details.review_permlink') : campaign.users.permlink;
  }

  const { user } = await userModel.findOne(campaign.users.name);
  if (user) campaign.users.wobjects_weight = user.wobjects_weight;
  /** we wrap users in an array, since the generic method for campaigns only accepts an array */
  campaign.users = [campaign.users];
  return campaign;
};

const getHistory = async ({
  skip, limit, sort, caseStatus, campaigns, guideNames,
  onlyWithMessages, locale, appName, campaignNames,
}) => {
  /** get conversations by all campaigns from hive */
  const { conversations } = await getConversationsFromHive(campaigns);

  campaigns.map(async (campaign) => fillCampaign(campaign, conversations));

  ({ campaigns } = await campaignHelper.getSecondaryCampaigns({
    allCampaigns: campaigns, skip: 0, limit: campaigns.length, sort, locale, appName,
  }));
  /** We get the real amount of reward by dividing
   * by the course and subtracting / adding extra rewards from the guide,
   * if user havent hive currency in reservations, get first from DB */
  const { result: currencies } = await currenciesStatisticModel.findOne({ type: 'ordinaryData' });
  campaigns.forEach((campaign) => {
    const hiveCurrency = campaign.users[0].hiveCurrency || _.get(currencies, 'hive.usd', 1);
    campaign.objects[0].reward = (campaign.reward / hiveCurrency)
        + campaign.users[0].rewardRaisedBy - (campaign.users[0].rewardReducedBy || 0);
  });
  campaigns = sortCampaignsHistory(campaigns, sort, caseStatus);

  let filteredCampaigns = _.cloneDeep(campaigns);
  /** Filter by guide names stage */
  if (guideNames && guideNames.length) {
    filteredCampaigns = _.filter(filteredCampaigns,
      (campaign) => _.includes(guideNames, campaign.guideName));
  }
  /** Filter by campaigns names stage */
  if (campaignNames && campaignNames.length) {
    filteredCampaigns = _.filter(filteredCampaigns,
      (campaign) => _.includes(campaignNames, campaign.name));
  }

  const result = onlyWithMessages
    ? filteredCampaigns.slice(skip, skip + limit)
    : filteredCampaigns.slice(0, limit);
  return {
    campaigns: result,
    hasMore: result.length < filteredCampaigns.length,
    sponsors: _.uniq(_.map(campaigns, 'guideName')),
    campaigns_types: _.uniq(_.map(campaigns, 'type')),
    campaigns_names: _.uniq(_.map(campaigns, 'name')),
  };
};

module.exports = async ({
  onlyWithMessages, skip, limit, sort, status, caseStatus, rewards, reservationPermlink,
  campaignNames, locale, appName, guideNames, guideName, userName, fraudSuspicion,
}) => {
  const { campaigns } = await campaignHelper.getCampaigns({
    matchData: getMatchData({
      reservationPermlink,
      limit: limit + 1,
      onlyWithMessages,
      fraudSuspicion,
      guideNames,
      guideName,
      userName,
      rewards,
      status,
      skip,
      sort,
    }),
  });
  if (!campaigns || !campaigns.length) {
    return {
      campaigns: [], campaigns_types: [], hasMore: false, sponsors: [], campaigns_names: [],
    };
  }
  return getHistory({
    onlyWithMessages,
    campaignNames,
    caseStatus,
    guideNames,
    campaigns,
    appName,
    locale,
    limit,
    skip,
    sort,
  });
};
