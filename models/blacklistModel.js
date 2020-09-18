const { Blacklist } = require('database').models;

const checkAndCreate = async (data) => {
  try {
    const blacklist = await Blacklist.findOne({ user: data.user });
    if (blacklist) return { blacklist };

    const newBlacklist = new Blacklist(data);

    await newBlacklist.save();
    return { blacklist: newBlacklist };
  } catch (error) {
    return { error };
  }
};

const findOne = async (condition) => {
  try {
    return { blackList: await Blacklist.findOne(condition).lean() };
  } catch (error) {
    return { error };
  }
};

const find = async (condition) => {
  try {
    return { blackLists: await Blacklist.find(condition).lean() };
  } catch (error) {
    return { error };
  }
};

const updateOne = async (condition, updateData) => {
  try {
    await checkAndCreate({ user: condition.user });
    return {
      result: await Blacklist.updateOne(condition, updateData),
    };
  } catch (error) {
    return { error };
  }
};

module.exports = {
  findOne, checkAndCreate, updateOne, find,
};
