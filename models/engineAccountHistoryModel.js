const { EngineAccountHistories } = require('database').models;

exports.find = async (condition) => {
  try {
    return {
      result: await EngineAccountHistories.find(condition),
    };
  } catch (error) {
    return { error };
  }
};
