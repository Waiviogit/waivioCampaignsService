const { redisStatisticsKey } = require('constants/sitesConstants');
const { appModel } = require('models');
const { redisSetter } = require('utilities/redis');

exports.saveUserIp = async (req, res, next) => {
  const { host } = req.headers;
  const ip = req.headers['x-real-ip'];
  const { result } = await appModel.findOne(host.replace('www.', ''));
  if (!ip || !result) return next();

  await redisSetter.addSiteActiveUser(`${redisStatisticsKey}:${host.replace('www.', '')}`, ip);
  next();
};
