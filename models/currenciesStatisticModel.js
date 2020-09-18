const { CurrenciesStatistic } = require('currenciesDB').models;

exports.findOne = async (condition = {}) => {
  try {
    return { result: await CurrenciesStatistic.findOne(condition).lean() };
  } catch (error) {
    return { error };
  }
};
