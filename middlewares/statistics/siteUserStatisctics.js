const { redisStatisticsKey } = require('constants/sitesConstants');
const { getNamespace } = require('cls-hooked');
const { appModel } = require('models');
const { redisSetter } = require('utilities/redis');

exports.saveUserIp = async (req, res, next) => {
  const session = getNamespace('request-session');
  const host = session.get('host');
  const ip = req.headers['x-real-ip'];

  const { result } = await appModel.findOne(host);
  if (!ip || !result) return next();

  await redisSetter.addSiteActiveUser(`${redisStatisticsKey}:${host}`, ip);
  next();
};
