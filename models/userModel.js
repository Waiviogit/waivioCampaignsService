const { User } = require('database').models;

exports.findByNames = async (names) => {
  try {
    return { users: await User.find({ name: { $in: names } }).lean() };
  } catch (error) {
    return { error };
  }
};

exports.findOne = async (name, keys) => {
  try {
    return { user: await User.findOne({ name }).select(keys).lean() };
  } catch (error) {
    return { error };
  }
};

exports.find = async (condition) => {
  try {
    return { users: await User.find(condition).lean() };
  } catch (error) {
    return { error };
  }
};

exports.aggregate = async (pipeline) => {
  try {
    return { result: await User.aggregate(pipeline) };
  } catch (error) {
    return { error };
  }
};

exports.updateOne = async (condition, updateData) => {
  try {
    return { user: await User.updateOne(condition, updateData).lean() };
  } catch (error) {
    return { error };
  }
};
