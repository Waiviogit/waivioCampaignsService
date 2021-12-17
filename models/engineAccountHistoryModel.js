const { EngineAccountHistories } = require('database').models;

exports.find = async ({
  condition, skip, limit, sort,
}) => {
  try {
    return {
      result: await EngineAccountHistories
        .find(condition)
        .sort(sort)
        .skip(skip)
        .limit(limit),
    };
  } catch (error) {
    return { error };
  }
};
