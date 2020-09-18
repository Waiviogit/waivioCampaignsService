const {
  BotUpvote, moment, expect, dropDatabase, sinon, botUpvoteModel, faker,
} = require('test/testHelper');
const { MatchBotFactory, BotUpvoteFactory } = require('test/factories');

describe('BotUpvote', async () => {
  describe('create', async () => {
    let params, matchBot;

    beforeEach(async () => {
      await dropDatabase();
      matchBot = await MatchBotFactory.Create({
        bot_name: 'bot1', sponsor: 'sponsor1', enabled: true, voting_percent: 0.5,
      });
      params = {
        botName: matchBot.bot_name,
        author: 'author',
        sponsor: 'sponsor',
        permlink: 'permlink',
        reward: 5.25,
        amountToVote: 5.25,
        requiredObject: faker.random.string(10),
        reservationPermlink: faker.random.string(10),
      };
    });

    afterEach(async () => {
      sinon.restore();
    });

    it('return success with all valid params', async () => {
      const { result } = await botUpvoteModel.create(params);

      expect(result).to.be.exist;
    });

    it('check reward', async () => {
      params.reward = 3.343343;
      await botUpvoteModel.create(params);
      const upvote = await BotUpvote.find();

      expect(upvote[0].reward).to.be.eq(3.343343);
    });

    it('return error without bot id', async () => {
      params.botName = undefined;
      const { error } = await botUpvoteModel.create(params);

      expect(error).to.be.exist;
    });

    it('return error with invalid author', async () => {
      params.author = undefined;
      const { error } = await botUpvoteModel.create(params);

      expect(error).to.be.exist;
    });

    it('return error with invalid permlink', async () => {
      params.permlink = undefined;
      const { error } = await botUpvoteModel.create(params);

      expect(error).to.be.exist;
    });
  });
  describe('getUpvotes', async () => {
    let sponsor1, sponsor2, botName1, botName2, matchBot1, matchBot2, expiredAt;

    beforeEach(async () => {
      await dropDatabase();
      botName1 = 'bot1';
      botName2 = 'bot2';
      sponsor1 = 'sponsor1';
      sponsor2 = 'sponsor2';
      expiredAt = moment().utc().add(1, 'days').startOf('date')
        .toDate();
      matchBot1 = await MatchBotFactory.Create({
        bot_name: botName1,
        sponsors: [
          { sponsor_name: 'sponsor1', enabled: true, expiredAt },
          { sponsor_name: 'sponsor2', enabled: true, expiredAt },
        ],
      });
      matchBot2 = await MatchBotFactory.Create({
        bot_name: botName2,
        sponsors: [
          { sponsor_name: 'sponsor1', enabled: true, expiredAt },
        ],
      });
      for (let i = 0; i < 3; i++) {
        await BotUpvoteFactory.Create({ bot_name: matchBot1.bot_name, sponsor: sponsor1 });
      }
    });

    it('get success with only one bot upvotes', async () => {
      const result = await botUpvoteModel.getUpvotes();

      expect(result.length).to.be.eq(1);
      expect(result[0]).to.have.all.keys('requiredObject', '_id',
        'reservationPermlink', 'author', 'bot_name', 'min_voting_power', 'permlink', 'sponsor', 'voting_percent', 'reward', 'totalVotesWeight', 'amountToVote');
    });

    it('get success with two bot upvotes', async () => {
      await BotUpvoteFactory.Create({ bot_name: matchBot2.bot_name, sponsor: sponsor1 });
      const result = await botUpvoteModel.getUpvotes();

      expect(result.length).to.be.eq(2);
    });

    it('get success with many bot upvotes', async () => {
      await BotUpvoteFactory.Create({ bot_name: matchBot2.bot_name, sponsor: sponsor1 });
      await BotUpvoteFactory.Create({ bot_name: matchBot2.bot_name, sponsor: sponsor2 });
      const result = await botUpvoteModel.getUpvotes();

      expect(result.length).to.be.eq(2);
    });

    it('should not return with upvoted status', async () => {
      await BotUpvoteFactory.Create({ bot_name: matchBot2.bot_name, sponsor: sponsor1, status: 'upvoted' });
      const result = await botUpvoteModel.getUpvotes();

      expect(result.length).to.be.eq(1);
    });

    it('check started time 1 minute before start', async () => {
      await BotUpvoteFactory.Create({ bot_name: matchBot2.bot_name, sponsor: sponsor1, startedAt: moment.utc().add(1, 'minutes') });
      const result = await botUpvoteModel.getUpvotes();

      expect(result.length).to.be.eq(1);
    });

    it('check started time 1 minute after start', async () => {
      await BotUpvoteFactory.Create({ bot_name: matchBot2.bot_name, sponsor: sponsor1, startedAt: moment.utc().subtract(1, 'minutes') });
      const result = await botUpvoteModel.getUpvotes();

      expect(result.length).to.be.eq(2);
    });

    it('check match bot with enabled false', async () => {
      const sponsor4 = 'sponsor4';
      const bot4 = 'bot4';

      const matchBot4 = await MatchBotFactory.Create(
        { bot_name: bot4, sponsor: sponsor4, enabled: false },
      );

      await BotUpvoteFactory.Create({ bot_name: matchBot4.bot_name, sponsor: sponsor4, startedAt: moment.utc().subtract(31, 'minutes') });
      const result = await botUpvoteModel.getUpvotes();

      expect(result.length).to.be.eq(1);
    });

    it('check match bot with enabled true', async () => {
      const sponsor4 = 'sponsor4';
      const bot4 = 'bot4';

      const matchBot4 = await MatchBotFactory.Create(
        { bot_name: bot4, sponsor: sponsor4, enabled: true },
      );

      await BotUpvoteFactory.Create({ bot_name: matchBot4.bot_name, sponsor: sponsor4, startedAt: moment.utc().subtract(2, 'minutes') });
      const result = await botUpvoteModel.getUpvotes();

      expect(result.length).to.be.eq(2);
    });
  });
  describe('getExpiredUpvotes', async () => {
    let sponsor1, botName1, matchBot1;

    beforeEach(async () => {
      await dropDatabase();
      botName1 = 'bot1';
      sponsor1 = 'sponsor1';
      matchBot1 = await MatchBotFactory.Create({ bot_name: botName1, sponsor: sponsor1 });

      await BotUpvoteFactory.Create({ bot_name: matchBot1.bot_name, sponsor: sponsor1 });
      for (let i = 0; i < 3; i++) {
        await BotUpvoteFactory.Create({ bot_name: matchBot1.bot_name, sponsor: sponsor1, status: 'upvoted' });
      }
      await BotUpvoteFactory.Create({ bot_name: matchBot1.bot_name, sponsor: sponsor1, status: 'pending' });
    });

    it('get only expired upvotes', async () => {
      const upvotes = await botUpvoteModel.getExpiredUpvotes();

      expect(upvotes.length).to.be.eq(3);
      expect(upvotes[0]).to.have.all.keys('botName', 'author', 'permlink', '_id', 'sponsor', 'createdAt', 'currentVote', 'reservationPermlink');
    });
  });
  describe('removeOne', async () => {
    let sponsor1, botName1, matchBot1, upvote;

    beforeEach(async () => {
      await dropDatabase();
      botName1 = 'bot1';
      sponsor1 = 'sponsor1';
      matchBot1 = await MatchBotFactory.Create({ bot_name: botName1, sponsor: sponsor1 });

      upvote = await BotUpvoteFactory.Create({ bot_name: matchBot1.bot_name, sponsor: sponsor1 });
    });

    it('return success', async () => {
      await botUpvoteModel.removeOne({ id: upvote._id });
      const upvotes = await BotUpvote.find();

      expect(upvotes.length).to.be.eq(0);
    });

    it('not remove invalid id', async () => {
      await botUpvoteModel.removeOne({ id: matchBot1._id });
      const upvotes = await BotUpvote.find();

      expect(upvotes.length).to.be.eq(1);
    });
  });
  describe('updateStatus', async () => {
    let sponsor1, botName1, matchBot1, upvote;

    beforeEach(async () => {
      await dropDatabase();
      botName1 = 'bot1';
      sponsor1 = 'sponsor1';
      matchBot1 = await MatchBotFactory.Create({ bot_name: botName1, sponsor: sponsor1 });

      upvote = await BotUpvoteFactory.Create({ bot_name: matchBot1.bot_name, sponsor: sponsor1 });
    });

    it('return success', async () => {
      const { result } = await botUpvoteModel.updateStatus({ id: upvote._id, status: 'upvoted' });
      const upvotes = await BotUpvote.find();

      expect(upvotes[0].status).to.be.eq('upvoted');
      expect(result).to.be.true;
    });

    it('return error with invalid status', async () => {
      const { error } = await botUpvoteModel.updateStatus({ id: upvote._id, status: 'aa' });

      expect(error).to.be.exist;
    });

    it('return error without status', async () => {
      const { error } = await botUpvoteModel.updateStatus({ id: upvote._id });

      expect(error).to.be.exist;
    });

    it('return error without id', async () => {
      const { error } = await botUpvoteModel.updateStatus({ id: null, status: 'aa' });

      expect(error).to.be.exist;
    });
  });
});
