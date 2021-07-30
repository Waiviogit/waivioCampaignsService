const { ExtendedMatchBot } = require('database').models;
const _ = require('lodash');

exports.find = async (condition, select) => {
  try {
    return { result: await ExtendedMatchBot.find(condition, select).lean() };
  } catch (error) {
    return { error };
  }
};

exports.findOne = async (condition, select) => {
  try {
    return { result: await ExtendedMatchBot.findOne(condition, select).lean() };
  } catch (error) {
    return { error };
  }
};

exports.setMatchBot = async (data) => {
  const { result: findMatchBot } = await this.findOne(
    { botName: data.botName, 'accounts.name': data.name, type: data.type },
  );

  if (findMatchBot) return this.updateMatchBot(data);
  return this.createMatchBot(data);
};

exports.createMatchBot = async (data) => {
  try {
    const { botName, type } = data;
    const result = await ExtendedMatchBot.updateOne(
      { botName, type },
      { $addToSet: { accounts: _.omit(data, ['botName', 'type']) } },
      { upsert: true, setDefaultsOnInsert: true, runValidators: true },
    );

    return !!result.n;
  } catch (error) {
    return false;
  }
};

exports.updateMatchBot = async (data) => {
  try {
    const { botName, type, name } = data;
    const result = await ExtendedMatchBot.updateOne(
      { botName, type, 'accounts.name': name },
      { $set: { 'accounts.$': _.omit(data, ['botName', 'type']) } },
      { runValidators: true, setDefaultsOnInsert: true },
    );

    return !!result.n;
  } catch (error) {
    return false;
  }
};

exports.unsetMatchBot = async ({ botName, type, name }) => {
  try {
    const result = ExtendedMatchBot.updateOne(
      { botName, type },
      { $pull: { accounts: { name } } },
    );

    return !!result.n;
  } catch (error) {
    return false;
  }
};

exports.updateStatus = async ({ botName, type, enabled }) => {
  const result = await ExtendedMatchBot.updateOne(
    { botName, type }, { 'accounts.$[].enabled': enabled }, { runValidators: true },
  );

  return !!result.n;
};
