const Joi = require('@hapi/joi');

const options = { allowUnknown: true, stripUnknown: true };


exports.sponsorMatchBotsSchema = Joi.object().keys({
  skip: Joi.number().default(0),
  limit: Joi.number().default(30),
  bot_name: Joi.string(),
}).options(options);
