const mongoose = require('mongoose');
const config = require('config');

const URI = process.env.MONGO_URI_CURRENCIES
  ? process.env.MONGO_URI_CURRENCIES
  : `mongodb://${config.currenciesDB.host}:${config.currenciesDB.port}/${config.currenciesDB.database}`;

module.exports = mongoose.createConnection(URI, {
  useNewUrlParser: true, useFindAndModify: false, useUnifiedTopology: true, useCreateIndex: true,
},
() => console.log('CurrenciesDB connection successful!'));
