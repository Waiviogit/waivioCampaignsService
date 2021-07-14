const { SUPPORTED_CURRENCIES } = require('constants/constants');
const { CurrenciesRate } = require('currenciesDB').models;
const moment = require('moment');
const _ = require('lodash');

const Create = async (data = {}) => {
  const randomCurrency = _.sample(
    Object.values(_.omit(SUPPORTED_CURRENCIES, SUPPORTED_CURRENCIES.USD)),
  );
  const currency = {
    base: data.base || SUPPORTED_CURRENCIES.USD,
    dateString: data.dateString || moment().format('YYYY-MM-DD'),
    rates: data.rates || { [randomCurrency]: _.random(1, 100) },
  };

  return CurrenciesRate.findOneAndUpdate(currency, currency, { upsert: true }).lean();
};

module.exports = { Create };
