const mongoose = require('mongoose');
const db = require('database/db_Connection');
const { PAYMENT_HISTORIES_TYPES } = require('constants/constants');
const BigNumber = require('bignumber.js');
const _ = require('lodash');
const { Decimal128 } = require('bson');

const { Schema } = mongoose;

const DetailsSchema = new Schema({
  main_object: { type: String },
  review_object: { type: String },
  review_permlink: { type: String },
  post_permlink: { type: String },
  reservation_permlink: { type: String },
  transfer_permlink: { type: String },
  votesAmount: { type: Decimal128 },
  hiveCurrency: { type: Decimal128 },
  beneficiaries: { type: Object },
  commissionWeight: { type: Decimal128 },
  payableInDollars: { type: Decimal128 },
  remaining: { type: Decimal128 },
});

const paymentHistorySchema = new Schema({
  userName: { type: String, required: true, index: true },
  sponsor: { type: String, index: true },
  type: { type: String, enum: Object.values(PAYMENT_HISTORIES_TYPES), required: true },
  app: { type: String },
  payed: { type: Boolean, default: false },
  withdraw: { type: String, default: null },
  amount: { type: Decimal128, required: true },
  is_demo_account: { type: Boolean, default: false },
  recounted: { type: Boolean, default: false },
  details: { type: DetailsSchema },
  memo: { type: String, default: '' },
}, {
  timestamps: true,
});

paymentHistorySchema.index({ createdAt: -1 });

paymentHistorySchema.set('toJSON', {
  transform: (doc, _doc) => {
    _doc.amount = new BigNumber(_.get(_doc, 'amount', 0)).toNumber();
    _doc.details.votesAmount = new BigNumber(_.get(_doc, 'details.votesAmount', 0)).decimalPlaces(4).toNumber();
    _doc.details.hiveCurrency = new BigNumber(_.get(_doc, 'details.hiveCurrency', 0)).decimalPlaces(4).toNumber();
    _doc.details.commissionWeight = new BigNumber(_.get(_doc, 'details.commissionWeight', 0)).decimalPlaces(4).toNumber();
    _doc.details.payableInDollars = new BigNumber(_.get(_doc, 'details.payableInDollars', 0)).decimalPlaces(4).toNumber();
    _doc.details.remaining = new BigNumber(_.get(_doc, 'details.remaining', 0)).decimalPlaces(4).toNumber();
    return _doc;
  },
});
const paymentHistoryModel = db.model('paymentHistory', paymentHistorySchema, 'payment_histories');

module.exports = paymentHistoryModel;
