const matchBotHelper = require('utilities/helpers/matchBotHelper');
const { BOTS_QUEUE } = require('constants/matchBotsData');
const RedisSMQWorker = require('rsmq-worker');
const config = require('config');

const curatorsBotQueue = new RedisSMQWorker(
  BOTS_QUEUE.CURATOR.NAME,
  {
    options: { db: config.redis.actionsQueue },
    autostart: true,
  },
);

curatorsBotQueue.on('message', async (msg, next, id) => {
  await matchBotHelper.voteExtendedMatchBots(msg);
  await curatorsBotQueue.del(id);
  next();
});

module.exports = curatorsBotQueue;
