const Joi = require('@hapi/joi');

const options = { allowUnknown: true, stripUnknown: true };

exports.validateAccountHistorySchema = Joi.object().keys({
  account: Joi.string().required(),
  skip: Joi.number().default(0),
  limit: Joi.number().default(10),
  timestampEnd: Joi.number().default(0),
  excludeCuratorAuthorRewards: Joi.boolean().default(false),
  excludeSymbols: Joi.array().items(Joi.string()),
  symbol: Joi.string()
    .when('excludeSymbols', { not: Joi.exist(), then: Joi.required() }),
}).options(options);
