const {
  faker, ExtendedMatchBot, moment, _,
} = require('test/testHelper');
const { MATCH_BOT_TYPES } = require('constants/matchBotsData');

const Create = async (data = {}) => {
  const matchBotData = {
    botName: data.botName || `${faker.name.firstName()}${faker.random.number()}`,
    type: data.type || _.sample(Object.values(MATCH_BOT_TYPES)),
    accounts: data.accounts || [{
      name: data.name || `${faker.name.firstName()}${faker.random.number()}`,
      minVotingPower: data.minVotingPower || 8000,
      enabled: data.enabled !== false,
      expiredAt: data.expiredAt || moment().utc().add(1, 'days').startOf('day').toDate(),
      note: data.note || 'some note',
    },
    ],
  };
  if (data.createData) {
    return {
      ..._.pick(matchBotData, ['botName', 'type']),
      ...matchBotData.accounts[0],
    };
  }
  const matchBot = new ExtendedMatchBot(matchBotData);

  await matchBot.save();
  return matchBot.toObject();
};

module.exports = { Create };
