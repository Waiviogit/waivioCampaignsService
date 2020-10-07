const { App } = require('database').models;

exports.findOne = async (host) => {
  try {
    return { result: await App.findOne({ host }).lean() };
  } catch (error) {
    return { error };
  }
};

exports.findByCondition = async (condition) => {
  try {
    return { result: await App.findOne(condition).lean() };
  } catch (error) {
    return { error };
  }
};
