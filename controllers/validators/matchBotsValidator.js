const { BOT_ENV_KEY, MATCH_BOT_TYPES } = require('constants/matchBotsData');
const Joi = require('@hapi/joi');
const moment = require('moment');

const options = { allowUnknown: true, stripUnknown: true };

exports.sponsorMatchBotsSchema = Joi.object().keys({
  skip: Joi.number().default(0),
  limit: Joi.number().default(30),
  bot_name: Joi.string(),
}).options(options);

exports.getMatchBotsSchema = Joi.object().keys({
  skip: Joi.number().default(0),
  limit: Joi.number().default(30),
  botName: Joi.string().required(),
  type: Joi.string().valid(...Object.values(MATCH_BOT_TYPES)).required(),
}).options(options);

exports.matchBotVoteSchema = Joi.object().keys({
  permlink: Joi.string().required(),
  author: Joi.string().required(),
  voter: Joi.string().required(),
  botKey: Joi.string().valid(...Object.values(BOT_ENV_KEY)).required(),
  minHBD: Joi.number().min(0.0001).required(),
  minVotingPower: Joi.number().integer().min(1).max(10000)
    .required(),
  voteWeight: Joi.number().integer().min(-10000).max(10000)
    .invalid(0)
    .required(),
  voteComments: Joi.boolean(),
}).options(options);

exports.matchBotSetSchema = Joi.object().keys({
  botName: Joi.string().required(),
  name: Joi.string().required(),
  type: Joi.string().valid(...Object.values(MATCH_BOT_TYPES)).required(),
  voteWeight: Joi.when('type', {
    is: MATCH_BOT_TYPES.AUTHOR,
    then: Joi.number().integer().min(1).max(10000)
      .required(),
    otherwise: Joi.forbidden(),
  }),
  voteRatio: Joi.when('type', {
    is: MATCH_BOT_TYPES.CURATOR,
    then: Joi.number().min(0.01).max(10)
      .required(),
    otherwise: Joi.forbidden(),
  }),
  note: Joi.string(),
  enabled: Joi.boolean().required(),
  enablePowerDown: Joi.boolean(),
  expiredAt: Joi.date().greater(moment().utc().add(1, 'days').startOf('day')),
  minVotingPower: Joi.number().integer().min(1).max(10000)
    .required(),
  voteComments: Joi.when('type', {
    is: MATCH_BOT_TYPES.CURATOR,
    then: Joi.boolean(),
    otherwise: Joi.forbidden(),
  }),
}).options(options);

exports.matchBotUnsetSchema = Joi.object().keys({
  botName: Joi.string().required(),
  name: Joi.string().required(),
  type: Joi.string().valid(...Object.values(MATCH_BOT_TYPES)).required(),
}).options(options);
