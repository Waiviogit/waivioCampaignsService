const Joi = require('joi');

const options = { allowUnknown: true, stripUnknown: true };

exports.validateAccountHistorySchema = Joi.object().keys({
  account: Joi.string().required(),
  skip: Joi.number().default(0),
  limit: Joi.number().default(10),
  showRewards: Joi.boolean().default(false),
  excludeSymbols: Joi.array().items(Joi.string()),
  symbol: Joi.string()
    .when('excludeSymbols', { not: Joi.exist(), then: Joi.required() }),
  timestampEnd: Joi.number().default(0),
  lastId: Joi.string().when('timestampEnd', { not: 0, then: Joi.required() }),
}).options(options);
