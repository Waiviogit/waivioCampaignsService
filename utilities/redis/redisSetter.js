const moment = require('moment');
const {
  lastBlockClient, campaigns, demoPosts, appUsersStatistics,
} = require('./redis');

const setLastBlockNum = async (blockNum, name) => {
  if (blockNum) {
    await lastBlockClient.setAsync(name, blockNum);
    await lastBlockClient.publish(name, blockNum);
  }
};

/**
 * Set active users to redis for collect statistics and invoicing
 */
exports.addSiteActiveUser = async (key, ip) => appUsersStatistics.saddAsync(key, ip);

/**
 * Set TTL to redis about campaign expiration
 * @param campaign
 */
const setExpireCampaign = (campaign) => {
  if (campaign) {
    const expiredData = parseInt(moment.utc(campaign.expired_at).format('X'), 10);
    const id = campaign._id.toString();

    campaigns.setexAsync(
      `expire:campaign_${id}`,
      expiredData - parseInt(moment.utc().format('X'), 10),
      '',
    );
    console.log(new Date().getTime());
    console.log(expiredData);
  }
};

/**
 *  create TTL and data with campaign assign info and expiration time
 * @param campaignPermlink {string}
 * @param assignPermlink {string}
 * @param approvedObject {string}
 * @param userName {string}
 * @param time {number}
 */
const setExpireAssign = (campaignPermlink, assignPermlink, approvedObject, userName, time) => {
  if (assignPermlink) {
    campaigns.setexAsync(`expire:assign_${assignPermlink}`, time, '');
    campaigns.setAsync(
      `assign_${assignPermlink}`,
      JSON.stringify({
        campaign_permlink: campaignPermlink,
        user_name: userName,
        assign_permlink: assignPermlink,
        approved_object: approvedObject,
      }),
    );
  }
};

/**
 * create demo post TTL
 * @param author {string}
 * @param permlink {string}
 * @returns {Promise<void>}
 */
const setDemoPost = async ({ author, permlink }) => {
  await demoPosts.setexAsync(`expire:demopost|${author}|${permlink}`, 609800, '');
};

const removeExpirationAssign = (assignPermlink) => {
  campaigns.del(`expire:assign_${assignPermlink}`);
};

const setSimpleTtl = async (data, timer) => {
  await demoPosts.setexAsync(data, timer, '');
};

const saveTTL = async (data, timer, value = '') => {
  await demoPosts.setAsync(data, value, 'EX', timer);
};

const deleteCampaignsData = async (key) => {
  await campaigns.del(key);
};

module.exports = {
  setDemoPost,
  setLastBlockNum,
  setExpireCampaign,
  setExpireAssign,
  removeExpirationAssign,
  setSimpleTtl,
  deleteCampaignsData,
  saveTTL,
};
