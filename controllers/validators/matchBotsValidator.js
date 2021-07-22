const Joi = require('@hapi/joi');

const options = { allowUnknown: true, stripUnknown: true };

exports.sponsorMatchBotsSchema = Joi.object().keys({
  skip: Joi.number().default(0),
  limit: Joi.number().default(30),
  bot_name: Joi.string(),
}).options(options);

exports.authorMatchVoteSchema = Joi.object().keys({
  author: Joi.string().required(),
  permlink: Joi.string().required(),
  voter: Joi.string().required(),
  minVotingPower: Joi.number().min(1).max(10000).required(),
  votingPercent: Joi.number().min(0.01).max(1).required(),
}).options(options);
