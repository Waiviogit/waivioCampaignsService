const matchBotHelper = require('utilities/helpers/matchBotHelper');
const { BOTS_QUEUE } = require('constants/matchBotsData');
const RedisSMQWorker = require('rsmq-worker');
const config = require('config');

const authorsBotQueue = new RedisSMQWorker(
  BOTS_QUEUE.AUTHOR.NAME,
  {
    options: { db: config.redis.actionsQueue },
    autostart: true,
  },
);

authorsBotQueue.on('message', async (msg, next, id) => {
  await matchBotHelper.voteExtendedMatchBots(msg);
  await authorsBotQueue.del(id);
  next();
});

module.exports = authorsBotQueue;
