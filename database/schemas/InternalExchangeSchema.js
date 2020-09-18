const mongoose = require('mongoose');
const db = require('database/db_Connection');

const { Schema } = mongoose;

const internalExchangeSchema = new Schema({
  type: { type: String, enum: ['fillOrder', 'limitOrder', 'cancelOrder'], required: true },
  account: { type: String, required: true, index: true },
  exchanger: { type: String },
  orderId: { type: Number, required: true, index: true },
  timestamp: { type: Number, required: true },
  current_pays: { type: String },
  open_pays: { type: String },
  amount_to_sell: { type: String },
  min_to_receive: { type: String },
  fillOrKill: { type: Boolean, default: false },
});

internalExchangeSchema.index({ account: 1, orderId: 1, type: 1 });

const internalExchangeModel = db.model('internalExchange', internalExchangeSchema, 'internal_exchange');

module.exports = internalExchangeModel;
