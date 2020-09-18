const { App } = require('database').models;

exports.findOne = async (name) => {
  try {
    return { result: await App.findOne({ name }).lean() };
  } catch (error) {
    return { error };
  }
};
