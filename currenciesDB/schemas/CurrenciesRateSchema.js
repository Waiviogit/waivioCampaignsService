const db = require('currenciesDB/currenciesDB_Connection');
const { BASE_CURRENCIES, RATE_CURRENCIES } = require('constants/serviceData');
const { SUPPORTED_CURRENCIES } = require('constants/constants');
const mongoose = require('mongoose');
const _ = require('lodash');

const rate = () => _.reduce(
  RATE_CURRENCIES,
  (acc, el) => {
    acc.rates[el] = { type: Number, required: true };
    return acc;
  },
  {
    dateString: { type: String, index: true },
    base: { type: String, default: SUPPORTED_CURRENCIES.USD, enum: BASE_CURRENCIES },
    rates: {},
  },
);
const CurrenciesRateSchema = new mongoose.Schema(rate(), { versionKey: false });

CurrenciesRateSchema.index({ base: 1, dateString: -1 }, { unique: true });

const CurrenciesRateModel = db.model('currencies-rate', CurrenciesRateSchema);

module.exports = CurrenciesRateModel;
