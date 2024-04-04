const Joi = require('joi');
const { availableCoins, availableCrypto } = require('constants/withdraw');

const options = { allowUnknown: true, stripUnknown: true };

exports.outputSchema = Joi.object().keys({
  inputAmount: Joi.number().required(),
  inputCoinType: Joi.string().valid(...availableCoins).required(),
  outputCoinType: Joi.string().valid(...availableCoins).required(),
  sessionToken: Joi.string(),
  affiliateId: Joi.string(),
}).options(options);

exports.validateWalletSchema = Joi.object().keys({
  address: Joi.string().required(),
  crypto: Joi.string().valid(...availableCrypto).required(),
}).options(options);

exports.demoDebtSchema = Joi.object().keys({
  userName: Joi.string().required(),
  type: Joi.string().valid('demo_user_transfer').required(),
  payable: Joi.number().required(),
  sponsor: Joi.string().required(),
  memo: Joi.string().required(),
}).options(options);

exports.immediateConfirmSchema = Joi.object().keys({
  userName: Joi.string().required(),
  accessToken: Joi.string().required(),
  transactionData: Joi.object().keys({
    outputCoinType: Joi.string().valid(...availableCoins).required(),
    inputCoinType: Joi.string().valid('hive').required(),
    amount: Joi.number().greater(0).required(),
    address: Joi.string().required(),
  }).required(),
}).options(options);
