const { MATCH_BOT_TYPES } = require('constants/matchBotsData');
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
