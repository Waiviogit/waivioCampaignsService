const curatorsBot = require('utilities/operations/matchBots/curatorsBot');
const {
  expect, revoteOnPost, dropDatabase, sinon, faker,
  _, matchBotModel, BotUpvote, matchBotHelper, hiveOperations, hiveClient, moment,
} = require('test/testHelper');
const { MATCH_BOT_TYPES } = require('constants/matchBotsData');
const { BotUpvoteFactory, ExtendedMatchBotFactory } = require('test/factories');
const { getVoteData } = require('./mocks');

describe('On processAuthorsMatchBot', async () => {
  beforeEach(async () => {
    await dropDatabase();
    const data = getVoteData({weight: -1});

    const accounts = [
      {
        name: `${faker.name.firstName()}${faker.random.number()}`,
        votingPercent: 1,
        minVotingPower: 8000,
        enabled: true,
        expiredAt: moment().utc().add(1, 'days').startOf('day'),
        note: '',
      },
      {
        name: data.voter,
        votingPercent: 1,
        enablePowerDown: true,
        minVotingPower: 8000,
        enabled: true,
        expiredAt: moment().utc().add(1, 'days').startOf('day'),
        note: '',
      },
    ];
    await ExtendedMatchBotFactory.Create({ type: MATCH_BOT_TYPES.CURATOR, accounts });
    await curatorsBot.processCuratorsMatchBot(data);
  });
  it('should ', async () => {
    console.log('yo');
  });
});
