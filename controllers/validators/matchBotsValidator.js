const Joi = require('@hapi/joi');
const {  BOT_ENV_KEY } = require('constants/matchBotsData');

const options = { allowUnknown: true, stripUnknown: true };

exports.sponsorMatchBotsSchema = Joi.object().keys({
  skip: Joi.number().default(0),
  limit: Joi.number().default(30),
  bot_name: Joi.string(),
}).options(options);

exports.matchBotVoteSchema = Joi.object().keys({
  permlink: Joi.string().required(),
  author: Joi.string().required(),
  voter: Joi.string().required(),
  botKey: Joi.string().enum(Object.values(BOT_ENV_KEY)).required(),
  minHBD: Joi.number().min(0.0001).required(),
  minVotingPower: Joi.number().integer().min(1).max(10000)
    .required(),
  voteWeight: Joi.number().integer().min(-10000).max(10000)
    .required(),
}).options(options);
