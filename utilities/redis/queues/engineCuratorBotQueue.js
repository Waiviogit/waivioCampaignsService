const matchBotHelper = require('utilities/helpers/matchBotHelper');
const jsonHelper = require('utilities/helpers/jsonHelper');
const { BOTS_QUEUE } = require('constants/matchBotsData');
const RedisSMQWorker = require('rsmq-worker');
const config = require('config');

const curatorsBotQueue = new RedisSMQWorker(
  BOTS_QUEUE.ENGINE_CURATOR.NAME,
  {
    options: { db: config.redis.actionsQueue, interval: [6], maxReceiveCount: 1 },
    autostart: true,
    interval: [6],
  },
);

curatorsBotQueue.on('message', async (msg, next, id) => {
  await matchBotHelper.voteEngineCurator(jsonHelper.parseJson(msg));
  await curatorsBotQueue.del(id);
  next();
});

module.exports = curatorsBotQueue;
