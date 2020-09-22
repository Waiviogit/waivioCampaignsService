const { faker, MatchBot, moment } = require('test/testHelper');

const Create = async (data= {}) => {
  const matchBotData = {
    bot_name: data.bot_name || `${faker.name.firstName()}${faker.random.number()}`,
    min_voting_power: data.min_voting_power || 8000,
    sponsors: data.sponsors || [{
      sponsor_name: data.sponsor || `${faker.name.firstName()}${faker.random.number()}`,
      voting_percent: data.voting_percent || 1,
      enabled: data.enabled !== false,
      expiredAt: data.expiredAt || moment().utc().add(1, 'days').startOf('day'),
      note: data.note || 'some note',
    },
    ],
  };
  const matchBot = new MatchBot(matchBotData);

  await matchBot.save();
  return matchBot.toObject();
};

module.exports = { Create };
