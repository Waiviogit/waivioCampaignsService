const db = require('database');
const {
  CAMPAIGN_STATUSES,
} = require('constants/constants');
const _ = require('lodash');

const ignoredKeys = [
  '_id',
  'createdAt',
  'updatedAt',
  'status',
  'activation_permlink',
  'deactivation_permlink',
  'stoppedAt',
  'users',
  'payments',
  'blacklist_users',
  'whitelist_users',
];

const guideBlacklist = new Map();

const createCampaign = async (campaign) => {
  try {
    const result = await db.models.CampaignV2.create(campaign);
    return { result };
  } catch (error) {
    console.log(error.message);
    return { error };
  }
};

const getNewKey = (oldKey) => {
  const oldToNew = {
    campaign_server: 'campaignServer',
    count_reservation_days: 'countReservationDays',
    match_bots: 'matchBots',
    frequency_assign: 'frequencyAssign',
    reservation_timetable: 'reservationTimetable',
    expired_at: 'expiredAt',
    rewardInCurrency: 'reward',
    reward: 'rewardInUSD',
  };
  return (oldToNew[oldKey] || oldKey);
};

const getGuideBlacklist = async (user) => {
  const cache = guideBlacklist.get(user);
  if (cache) return cache;
  const response = await db.models.Blacklist.findOne({ user }).lean();
  if (_.isEmpty(response)) {
    const emptyResp = { blacklistUsers: [], whitelistUsers: [] };
    guideBlacklist.set(user, emptyResp);
    return emptyResp;
  }

  const list = [...response.blackList];
  for (const item of response.followLists) {
    list.push(...item.blackList);
  }
  const respFromDb = {
    blacklistUsers: list,
    whitelistUsers: response.whiteList,
  };
  guideBlacklist.set(user, respFromDb);
  return respFromDb;
};

const migrateCampaign = async (oldCampaign) => {
  const { blacklistUsers, whitelistUsers } = await getGuideBlacklist(oldCampaign.guideName);
  const campaign = {
    payoutToken: 'WAIV',
    status: CAMPAIGN_STATUSES.PENDING,
    blacklistUsers,
    whitelistUsers,
  };

  for (const oldKey in oldCampaign) {
    if (ignoredKeys.includes(oldKey)) continue;
    if (oldKey === 'match_bots') {
      if (!_.isEmpty(oldCampaign.match_bots)) {
        campaign.matchBots = ['waivio.com'];
        continue;
      }
    }
    campaign[getNewKey(oldKey)] = oldCampaign[oldKey];
  }
  const { result, error } = await createCampaign(campaign);
  if (error) return;

  await db.models.Campaign.updateOne(
    { _id: oldCampaign._id },
    { $set: { migrated: true } },
  );
};

exports.start = async (guideName) => {
  const campaigns = await db.models.Campaign.find({
    status: { $in: [CAMPAIGN_STATUSES.ON_HOLD, CAMPAIGN_STATUSES.ACTIVE] },
    migrated: { $ne: true },
    ...(guideName && { guideName }),
  }).lean();
  if (_.isEmpty(campaigns)) return;
  for (const campaign of campaigns) await migrateCampaign(campaign);
  console.log('Task completed');
};
