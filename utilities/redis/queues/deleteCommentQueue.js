const { REDIS_QUEUE_DELETE_COMMENT } = require('constants/constants');
const campaignsHelper = require('utilities/helpers/campaignsHelper');
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

deleteCommentQueue.messageHandler = async (msg, next, id) => {
  const { value, error } = validators
    .campaigns
    .campaignsRemoveObligationsSchema
    .validate(jsonHelper.parseJson(msg));
  if (error) return false;

  await campaignsHelper.deleteSponsorObligationsHelper(value);
  await deleteCommentQueue.del(id);
  next();
};

deleteCommentQueue.on('message', deleteCommentQueue.messageHandler);

module.exports = deleteCommentQueue;
