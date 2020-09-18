const Joi = require('@hapi/joi');

const options = { allowUnknown: true, stripUnknown: true };


exports.transferSchema = Joi.object().keys({
  to: Joi.string().required(),
  amount: Joi.number().required(),
  memo: Joi.string().allow('').default(''),
}).options(options);
