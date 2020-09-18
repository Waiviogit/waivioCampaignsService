const { ReservationCurrencies } = require('currenciesDB').models;

exports.findOne = async (condition) => {
  try {
    return { result: await ReservationCurrencies.findOne(condition).lean() };
  } catch (error) {
    return { error };
  }
};

exports.deleteOne = async (condition) => {
  try {
    return { result: await ReservationCurrencies.deleteOne(condition).lean() };
  } catch (error) {
    return { error };
  }
};
