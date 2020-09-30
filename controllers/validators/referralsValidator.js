const Joi = require('@hapi/joi');
const { SORT_TYPES } = require('constants/constants');

const options = { allowUnknown: true, stripUnknown: true };

exports.statusSchema = Joi.object().keys({
  userName: Joi.string().required(),
  sort: Joi.string().valid(SORT_TYPES.EXPIRY, SORT_TYPES.RECENCY).default(SORT_TYPES.RECENCY),
  limit: Joi.number().default(10),
  skip: Joi.number().default(0),
}).required().options(options);

exports.blackListSchema = Joi.object().keys({
  userName: Joi.string().required(),
  host: Joi.string().required(),
}).required().options(options);
