const mongoose = require('mongoose');
const db = require('currenciesDB/currenciesDB_Connection');
const serviceData = require('constants/serviceData');

const { Schema } = mongoose;

const currency = () => {
  const data = {};
  for (const curr of serviceData.allowedCurrencies) {
    data[curr] = { type: Number, required: true };
    data[`${curr}_24h_change`] = { type: Number, required: true };
  }
  return data;
};

const currencySchema = new Schema(currency(), { _id: false });

const statistic = () => {
  const data = {};
  for (const id of serviceData.allowedIds) {
    data[id] = { type: currencySchema, required: true };
  }
  data.type = {
    type: String, default: 'ordinaryData', valid: ['ordinaryData', 'dailyData'], index: true,
  };
  return data;
};

const currenciesStatisticSchema = new Schema(statistic(), { timestamps: true });

currenciesStatisticSchema.index({ createdAt: 1 });

const currenciesSchema = db.model('currencies-statistic', currenciesStatisticSchema);

module.exports = currenciesSchema;
