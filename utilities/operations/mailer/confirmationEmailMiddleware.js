const { userModel } = require('models');

module.exports = async (query) => {
  await userModel.updateOne({ name: query.userName }, { $set: { privateEmail: query.email } });
};
