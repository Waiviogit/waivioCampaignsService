const { ExtendedMatchBot } = require('database').models;

exports.find = async (condition, select) => {
  try {
    return { result: await ExtendedMatchBot.find(condition, select).lean() };
  } catch (error) {
    return { error };
  }
};
