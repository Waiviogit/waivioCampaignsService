const _ = require('lodash');
const { redisStatisticsKey, STATUSES } = require('constants/sitesConstants');
const { getNamespace } = require('cls-hooked');
const config = require('config');
const { appModel } = require('models');
const { redisSetter } = require('utilities/redis');

exports.saveUserIp = async (req, res, next) => {
  const session = getNamespace('request-session');
  const host = session.get('host');
  const ip = req.headers['x-real-ip'];

  const { result } = await appModel.findOne(host);
  if (!ip || !result) return next();

  if (result.status === STATUSES.SUSPENDED) {
    const { origin, referer } = req.headers;
    if (!origin || !referer) return res.redirect(307, `https://${config.appHost}`);
    const { result: parent } = await appModel.findByCondition({ _id: result.parent });

    const parentHost = `https://${_.get(parent, 'host', config.appHost)}${referer.replace(origin, '')}`;
    return res.redirect(307, parentHost);
  }

  await redisSetter.addSiteActiveUser(`${redisStatisticsKey}:${host}`, ip);
  next();
};
