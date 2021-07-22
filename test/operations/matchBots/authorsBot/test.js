const authorsBot = require('utilities/operations/matchBots/authorsBot');
const {
  expect, revoteOnPost, dropDatabase, sinon, faker,
  _, matchBotModel, BotUpvote, matchBotHelper, hiveOperations, hiveClient, moment,
} = require('test/testHelper');
const { MATCH_BOT_TYPES } = require('constants/matchBotsData');
const { BotUpvoteFactory, ExtendedMatchBotFactory } = require('test/factories');
const { getPostData, getVoteData } = require('./mocks');

describe('On processAuthorsMatchBot', async () => {
  beforeEach(async () => {
    await dropDatabase();
    const data = getPostData();

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
        name: data.author,
        votingPercent: 1,
        minVotingPower: 8000,
        enabled: true,
        expiredAt: moment().utc().add(1, 'days').startOf('day'),
        note: '',
      },
    ];
    await ExtendedMatchBotFactory.Create({ type: MATCH_BOT_TYPES.AUTHOR, accounts });
    await authorsBot.processAuthorsMatchBot(data);
  });
  it('should ', async () => {
    console.log('yo');
  });
});

describe('On voteAuthorMatchBot', async () => {
  beforeEach(async () => {
    await dropDatabase();
    const data = getVoteData({ stringify: true });
    await authorsBot.voteAuthorMatchBot(data);
  });

  it('should ', async () => {
    console.log('yo');
  });
});
