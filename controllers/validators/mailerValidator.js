const Joi = require('joi');
const { availableCoins } = require('constants/withdraw');

const options = { allowUnknown: true, stripUnknown: true };

exports.confirmRequestSchema = Joi.object().keys({
  type: Joi.string().valid('confirmEmail', 'confirmTransaction', 'pullEmail').required(),
  email: Joi.string().email(),
  userName: Joi.string().required(),
  isGuest: Joi.boolean().required(),
  accessToken: Joi.string().required(),
  transactionData: Joi.when('type', [{
    is: 'confirmEmail',
    then: Joi.object().default({}),
  }, {
    is: 'confirmTransaction',
    then: Joi.object().keys({
      outputCoinType: Joi.string().valid(...availableCoins).required(),
      inputCoinType: Joi.string().valid('hive').required(),
      amount: Joi.number().greater(0).required(),
      address: Joi.string().required(),
    }).required(),
  }]),
}).options(options);

exports.confirmResponseSchema = Joi.object().keys({
  type: Joi.string().valid('confirm', 'unlink').required(),
  email: Joi.string().email(),
  userName: Joi.string().required(),
  id: Joi.string().required(),
}).options(options);
