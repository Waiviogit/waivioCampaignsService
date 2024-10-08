const mongoose = require('mongoose');
const db = require('database/db_Connection');
const { PAYMENT_HISTORIES_TYPES } = require('constants/constants');

const { Schema } = mongoose;

const paymentHistorySchema = new Schema({
  userName: { type: String, required: true, index: true },
  sponsor: { type: String, index: true },
  type: { type: String, enum: Object.values(PAYMENT_HISTORIES_TYPES), required: true },
  app: { type: String },
  payed: { type: Boolean, default: false },
  withdraw: { type: String, default: null },
  amount: { type: Number, required: true },
  is_demo_account: { type: Boolean, default: false },
  recounted: { type: Boolean, default: false },
  details: { type: Object },
  memo: { type: String, default: '' },
}, {
  timestamps: true,
});

paymentHistorySchema.index({ createdAt: -1 });

const paymentHistoryModel = db.model('paymentHistory', paymentHistorySchema, 'payment_histories');

module.exports = paymentHistoryModel;
