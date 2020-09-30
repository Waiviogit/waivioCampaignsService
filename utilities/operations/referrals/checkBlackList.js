const _ = require('lodash');
const { appModel } = require('models');

module.exports = async (params) => {
  const { result } = await appModel.findOne(params.host);
  if (!result) return { error: { status: 404, message: 'App not found!' } };

  return { isBlacklisted: _.contains(result.black_list_users || [], params.userName) };
};
