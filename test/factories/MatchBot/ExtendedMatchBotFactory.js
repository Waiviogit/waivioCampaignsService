const { faker, ExtendedMatchBot, moment } = require('test/testHelper');
const { MATCH_BOT_TYPES } = require('constants/matchBotsData');

const Create = async (data = {}) => {
  const matchBotData = {
    botName: data.botName || `${faker.name.firstName()}${faker.random.number()}`,
    type: data.type || _.sample(Object.values(MATCH_BOT_TYPES)),
    accounts: data.accounts || [{
      name: data.sponsor || `${faker.name.firstName()}${faker.random.number()}`,
      minVotingPower: data.minVotingPower || 8000,
      votingPercent: data.votingPercent || 1,
      enabled: data.enabled !== false,
      expiredAt: data.expiredAt || moment().utc().add(1, 'days').startOf('day'),
      note: data.note || 'some note',
    },
    ],
  };
  const matchBot = new ExtendedMatchBot(matchBotData);

  await matchBot.save();
  return matchBot.toObject();
};

module.exports = { Create };
