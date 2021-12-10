const { EngineAccountHistories } = require('database').models;

exports.find = async (condition, skip, limit) => {
  try {
    if (limit) {
      return {
        result: await EngineAccountHistories
          .find(condition)
          .skip(skip)
          .limit(limit),
      };
    } else {
      return {
        result: await EngineAccountHistories.find(condition),
      };
    }
  } catch (error) {
    return { error };
  }
};
