const Joi = require('@hapi/joi');

const options = { allowUnknown: true, stripUnknown: true };

exports.validateAccountHistorySchema = Joi.object().keys({
  account: Joi.string().required(),
  skip: Joi.number().default(0),
  limit: Joi.number().default(10),
  symbol: Joi.string().required(),
}).options(options);
