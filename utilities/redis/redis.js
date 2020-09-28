const redis = require('redis');
const bluebird = require('bluebird');
const config = require('config');
const Subscriber = require('./subscriberHelper');

bluebird.promisifyAll(redis.RedisClient.prototype);
bluebird.promisifyAll(redis.Multi.prototype);

const lastBlockClient = redis.createClient(process.env.REDISCLOUD_URL);
const demoPosts = redis.createClient(process.env.REDISCLOUD_URL);
const campaigns = redis.createClient(process.env.REDISCLOUD_URL);
const notifications = redis.createClient(process.env.REDISCLOUD_URL);
const appUsersStatistics = redis.createClient(process.env.REDISCLOUD_URL);

lastBlockClient.select(config.redis.lastBlock);
campaigns.select(config.redis.campaigns);
notifications.select(config.redis.notifications);
demoPosts.select(config.redis.demoPosts);
appUsersStatistics.select(config.redis.appDayUsers);

const campaigsPublisher = redis.createClient({ db: config.redis.campaigns });
const demoPostsPublisher = redis.createClient({ db: config.redis.matchBotUpvotes });

const subscribeCampaignExpired = (onMessageCallBack) => {
  const subscribeExpired = () => {
    const subscriber = redis.createClient({ db: config.redis.campaigns });
    const expiredSubKey = `__keyevent@${config.redis.campaigns}__:expired`;

    Subscriber.expireHelper(subscriber, expiredSubKey, onMessageCallBack);
  };
  campaigsPublisher.send_command('config', ['Ex'], subscribeExpired);
};

const subscribeDemoPostsExpired = (onMessageCallBack) => {
  const subscribeExpired = () => {
    const subscriber = redis.createClient({ db: config.redis.demoPosts });
    const expiredSubKey = `__keyevent@${config.redis.demoPosts}__:expired`;

    Subscriber.expireHelper(subscriber, expiredSubKey, onMessageCallBack);
  };
  demoPostsPublisher.send_command('config', ['Ex'], subscribeExpired);
};

module.exports = {
  lastBlockClient,
  campaigns,
  notifications,
  demoPosts,
  subscribeDemoPostsExpired,
  subscribeCampaignExpired,
  appUsersStatistics,
};
