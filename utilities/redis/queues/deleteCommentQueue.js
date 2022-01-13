const campaignsHelper = require('utilities/helpers/campaignsHelper');
const { REDIS_QUEUE_DELETE_COMMENT } = require('constants/constants');
const jsonHelper = require('utilities/helpers/jsonHelper');
const validators = require('controllers/validators');
const RedisSMQWorker = require('rsmq-worker');
const config = require('config');

const deleteCommentQueue = new RedisSMQWorker(
  REDIS_QUEUE_DELETE_COMMENT,
  {
    options: { db: config.redis.actionsQueue },
    autostart: true,
  },
);

deleteCommentQueue.on('message', async (msg, next, id) => {
  const { value, error } = validators
    .campaigns
    .campaignsRemoveObligationsSchema
    .validate(jsonHelper.parseJson(msg));
  if (error) return;

  await campaignsHelper.deleteSponsorObligationsHelper(value);
  await deleteCommentQueue.del(id);
  next();
});

module.exports = deleteCommentQueue;
