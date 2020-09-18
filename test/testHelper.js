const chai = require('chai');
const chaiHttp = require('chai-http');
const _ = require('lodash');

const { expect } = chai;
const axios = require('axios');
const { Mongoose, models } = require('database');
const faker = require('faker');
const sinon = require('sinon');
const app = require('app');
const { ObjectID } = require('bson');
const moment = require('moment');
const redis = require('utilities/redis/redis');
const redisSetter = require('utilities/redis/redisSetter');
const redisGetter = require('utilities/redis/redisGetter');
const { Constants } = require('../constants');

const dropDatabase = async () => {
  for (const model in models) {
    await models[model].deleteMany();
  }
  await redis.lastBlockClient.flushdbAsync();
  await redis.campaigns.flushdbAsync();
  await redis.notifications.flushdbAsync();
  await redis.demoPosts.flushdbAsync();
};

faker.random.string = (length = 5) => faker.internet.password(length, false, /[a-z]/);

module.exports = {
  redisSetter,
  redisGetter,
  redis,
  chai,
  chaiHttp,
  expect,
  faker,
  sinon,
  moment,
  axios,
  _,
  ObjectID,
  dropDatabase,
  app,
  ...require('utilities/operations/campaigns'),
  ...require('parsers'),
  ...require('utilities/requests'),
  ...require('utilities/helpers'),
  ...require('models'),
  ...require('utilities/operations/parsers/commentParser'),
  Constants,
  ...models,
  Mongoose,
};
