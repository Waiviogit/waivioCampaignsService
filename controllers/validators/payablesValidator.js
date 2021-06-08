const moment = require('moment');
const Joi = require('@hapi/joi');
const {
  WALLET_TYPES_FOR_PARSE,
  PAYMENT_HISTORIES_TYPES, GUEST_WALLET_OPERATIONS,
} = require('constants/constants');

const options = { allowUnknown: true, stripUnknown: true };

exports.payablesSchema = Joi.object().keys({
  skip: Joi.number().default(0),
  limit: Joi.number().default(30),
  days: Joi.number().default(0),
  payable: Joi.number(),
  sponsor: Joi.string(),
  endDate: Joi.date().timestamp('unix').less('now').default(new Date()),
  startDate: Joi.date().timestamp('unix').less(Joi.ref('endDate')).default(new Date('1-1-1970')),
  userName: Joi.string(),
  type: Joi.string().valid(...Object.values(PAYMENT_HISTORIES_TYPES)),
  sort: Joi.string(),
  currency: Joi.string().valid('usd', 'hive').default('hive'),
  objects: Joi.array().items(Joi.string()).default([]),
  globalReport: Joi.boolean().default(false),
  processingFees: Joi.boolean().default(false),
  referral: Joi.string(),
}).options(options);

exports.demoDeptSchema = Joi.object().keys({
  skip: Joi.number().default(0),
  limit: Joi.number().default(5),
  userName: Joi.string().required(),
  operationNum: Joi.number().default(-1),
  types: Joi.array().items(Joi.string().valid(...WALLET_TYPES_FOR_PARSE, ...GUEST_WALLET_OPERATIONS))
    .single().default([...GUEST_WALLET_OPERATIONS, ...WALLET_TYPES_FOR_PARSE]),
  endDate: Joi.date().timestamp('unix').less('now').default(new Date()),
  startDate: Joi.date().timestamp('unix').default(moment.utc().subtract(10, 'year').toDate()).less(Joi.ref('endDate')),
}).options(options);

exports.reportSchema = Joi.object().keys({
  guideName: Joi.string().required(),
  userName: Joi.string().required(),
  reservationPermlink: Joi.string().required(),
}).required().options(options);

exports.pendingTransfer = Joi.object().keys({
  memo: Joi.string().required(),
  sponsor: Joi.string().required(),
  userName: Joi.string().required(),
  amount: Joi.number().required(),
  transactionId: Joi.string().required(),
}).required().options(options);

exports.warningPayables = Joi.object().keys({
  userName: Joi.string().required(),
}).required().options(options);

exports.advancedWalletSchema = Joi.object().keys({
  accounts: Joi.array().items(Joi.object().keys({
    name: Joi.string().required(),
    guest: Joi.boolean().required(),
    skip: Joi.when('guest', { is: true, then: Joi.number().default(0) }),
    operationNum: Joi.when('guest', { is: false, then: Joi.number().default(-1) }),
  })).single().min(1)
    .required(),
  endDate: Joi.date().timestamp('unix').less('now').default(new Date()),
  startDate: Joi.date().timestamp('unix').default(moment.utc().subtract(10, 'year').toDate()).less(Joi.ref('endDate')),
  filterAccounts: Joi.array().items(Joi.string()).min(1).required(),
  limit: Joi.number().default(10),
  user: Joi.string().default(''),
}).options(options);

exports.walletExemptionsSchema = Joi.object().keys({
  userName: Joi.string().required(),
  userWithExemptions: Joi.string().required(),
  operationNum: Joi.when('userWithExemptions', {
    is: Joi.string()
      .pattern(new RegExp('^((?!_).)*$')),
    then: Joi.number().required(),
    otherwise: Joi.forbidden(),
  }),
  _id: Joi.when('userWithExemptions', {
    is: Joi.string()
      .pattern(new RegExp('_')),
    then: Joi.string().required(),
    otherwise: Joi.forbidden(),
  }),
  checked: Joi.boolean().required(),
}).options(options);
