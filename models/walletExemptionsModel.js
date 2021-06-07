const { WalletExemptions } = require('database').models;

exports.updateOne = async (condition, updateData) => {
  try {
    return {
      result: await WalletExemptions.updateOne(condition, updateData, { upsert: true }).lean(),
    };
  } catch (error) {
    return { error };
  }
};

exports.find = async (condition, select = {}) => {
  try {
    return {
      result: await WalletExemptions.find(condition, select).lean(),
    };
  } catch (error) {
    return { error };
  }
};
