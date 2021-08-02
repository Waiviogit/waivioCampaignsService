const { MATCH_BOT_TYPES, BOT_ENV_KEY } = require('constants/matchBotsData');
const { faker } = require('test/testHelper');
const moment = require('moment');
const _ = require('lodash');

exports.getSetBotData = (data = {}) => {
  const botName = data.botName || faker.random.string();
  const json = {
    type: data.type || _.sample(Object.values(MATCH_BOT_TYPES)),
    note: data.note || faker.random.string(),
    name: data.name || faker.random.string(),
    enabled: !!data.enabled,
    enablePowerDown: !!data.enablePowerDown,
    expiredAt: data.expiredAt || moment().utc().add(1, 'days').toDate(),
  };
  if (json.type === MATCH_BOT_TYPES.CURATOR) {
    json.voteRatio = data.voteRatio || _.random(0.01, 10);
  }
  if (json.type === MATCH_BOT_TYPES.AUTHOR) {
    json.voteWeight = data.voteWeight || _.random(1, 10000);
  }
  if (data.remove) {
    delete json[data.remove];
  }

  return { botName, json };
};

exports.getCanVoteMock = (data = {}) => {
  const canVoteData = {
    name: data.name || faker.random.string(),
    voteWeight: data.voteWeight || faker.random.string(),
    author: data.author || faker.random.string(),
    permlink: data.permlink || faker.random.string(),
    minVotingPower: data.minVotingPower || _.random(1, 10000),
    minHBD: data.minHBD || _.random(0.001, 10),
  };
  return canVoteData;
};

exports.getVoteDataMock = (data = {}) => {
  const voteData = {
    voter: data.voter || faker.random.string(),
    botKey: data.botKey || _.sample(Object.values(BOT_ENV_KEY)),
    author: data.author || faker.random.string(),
    permlink: data.permlink || faker.random.string(),
    minVotingPower: data.minVotingPower || _.random(1, 10000),
    minHBD: data.minHBD || _.random(0.001, 10),
    voteWeight: data.voteWeight || _.random(1, 10000),
  };
  if (data.remove) {
    delete voteData[data.remove];
  }
  return voteData;
};
