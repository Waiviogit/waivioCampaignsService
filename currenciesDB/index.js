const mongoose = require('mongoose');

mongoose.Promise = global.Promise;

module.exports = {
  Mongoose: mongoose,
  models: {
    ReservationCurrencies: require('./schemas/ReservationCurrenciesSchema'),
    CurrenciesStatistic: require('./schemas/CurrenciesStatisticSchema'),
    CurrenciesRate: require('./schemas/CurrenciesRateSchema'),
  },
};
