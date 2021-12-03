const { EngineAccountHistories } = require('database').models;

exports.find = async (condition, skip, limit) => {
  try {
    return {
      result: await EngineAccountHistories.find(condition)
        .skip(skip)
        .limit(limit),
    };
  } catch (error) {
    return { error };
  }
};
