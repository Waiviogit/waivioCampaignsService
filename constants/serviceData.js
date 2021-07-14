const { SUPPORTED_CURRENCIES } = require('constants/constants');

exports.allowedIds = ['hive', 'hive_dollar'];
exports.allowedCurrencies = ['usd', 'btc'];

exports.BASE_CURRENCIES = [
  SUPPORTED_CURRENCIES.USD,
];

exports.RATE_CURRENCIES = [
  SUPPORTED_CURRENCIES.CAD,
  SUPPORTED_CURRENCIES.EUR,
  SUPPORTED_CURRENCIES.AUD,
  SUPPORTED_CURRENCIES.MXN,
  SUPPORTED_CURRENCIES.GBP,
  SUPPORTED_CURRENCIES.JPY,
  SUPPORTED_CURRENCIES.CNY,
  SUPPORTED_CURRENCIES.RUB,
  SUPPORTED_CURRENCIES.UAH,
];
