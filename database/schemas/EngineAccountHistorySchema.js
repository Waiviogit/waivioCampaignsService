const mongoose = require('mongoose');
const db = require('database/db_Connection');

const { Schema } = mongoose;

const EngineAccountHistorySchema = new Schema({
  refHiveBlockNumber: { type: Number },
  blockNumber: { type: Number },
  account: { type: String },
  transactionId: { type: String },
  operation: { type: String },
  symbolOut: { type: String },
  symbolOutQuantity: { type: String },
  symbolIn: { type: String },
  symbolInQuantity: { type: String },
  timestamp: { type: Number },
  quantity: { type: String },
  symbol: { type: String },
  tokenState: { type: String },
});
const EngineAccountHistoryModel = db.model('EngineAccountHistories', EngineAccountHistorySchema, 'engine_account_histories');

module.exports = EngineAccountHistoryModel;
