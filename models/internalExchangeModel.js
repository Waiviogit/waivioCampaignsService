const { InternalExchange } = require('database').models;

const create = async (data) => {
  const newExchange = new InternalExchange(data);
  try {
    return { exchange: await newExchange.save() };
  } catch (error) {
    console.error(error.message);
    return { error };
  }
};

const find = async (condition) => {
  try {
    return { result: await InternalExchange.find(condition).sort({ timestamp: -1 }).lean() };
  } catch (error) {
    return { error };
  }
};

const findOne = async (condition) => {
  try {
    return { result: await InternalExchange.findOne(condition).lean() };
  } catch (error) {
    return { error };
  }
};

module.exports = { create, find, findOne };
