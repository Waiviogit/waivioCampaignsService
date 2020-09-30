const _ = require('lodash');
const { getNamespace } = require('cls-hooked');
const { appModel } = require('models');

module.exports = async (params) => {
  const session = getNamespace('request-session');
  const host = session.get('host');
  const { result } = await appModel.findOne(host);
  if (!result) return { error: { status: 404, message: 'App not found!' } };

  return { isBlacklisted: _.includes(result.black_list_users || [], params.userName) };
};
