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
  // handler
  next();
});

module.exports = curatorsBotQueue;
