const { Wobject } = require('database').models;

exports.aggregate = async (pipeline) => {
  try {
    return { result: await Wobject.aggregate(pipeline) };
  } catch (error) {
    return { error };
  }
};

exports.findOne = async (authorPermlink) => {
  try {
    return { result: await Wobject.findOne({ author_permlink: authorPermlink }).lean() };
  } catch (error) {
    return { error };
  }
};

exports.find = async (condition) => {
  try {
    return { result: await Wobject.find(condition).lean() };
  } catch (error) {
    return { error };
  }
};
