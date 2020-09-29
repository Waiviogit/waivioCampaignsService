const Joi = require('@hapi/joi');

const options = { allowUnknown: true, stripUnknown: true };

exports.transferSchema = Joi.object().keys({
  app: Joi.string(),
  id: Joi.string(),
  data: Joi.object().keys({
    to: Joi.string().required(),
    amount: Joi.number().required(),
    memo: Joi.string().allow('').default(''),
  }).required(),
}).options(options);
