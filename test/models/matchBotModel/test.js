const {
  MatchBot, expect, dropDatabase, _, moment, matchBotModel,
} = require('test/testHelper');
const { MatchBotFactory } = require('test/factories');

describe('MatchBot Model', async () => {
  describe('set', async () => {
    let params;

    beforeEach(async () => {
      await dropDatabase();
      params = {
        bot_name: 'user1',
        sponsor: 'sponsor1',
        enabled: true,
        expiredAt: moment().utc().add(1, 'days').startOf('date')
          .toDate(),
      };
    });
    describe('create', async () => {
      it('create match bot with default settings', async () => {
        const result = await matchBotModel.setMatchBot(params);

        expect(result).to.be.true;
      });

      it('create match bot with voting_percent', async () => {
        params.voting_percent = 0.5;
        const result = await matchBotModel.setMatchBot(params);
        const matchBot = await MatchBot.findOne({ bot_name: 'user1', 'sponsors.sponsor_name': 'sponsor1' });

        expect(result).to.be.true;
        expect(matchBot.sponsors[0].voting_percent).to.be.eq(0.5);
      });

      it('create match bot with notes', async () => {
        const note = 'Note';

        params.note = note;
        const result = await matchBotModel.setMatchBot(params);
        const matchBot = await MatchBot.findOne({ bot_name: 'user1', 'sponsors.sponsor_name': 'sponsor1' });

        expect(matchBot.sponsors[0].note).to.be.eq(note);
        expect(result).to.be.true;
      });

      it('create two match bots', async () => {
        await MatchBotFactory.Create({ bot_name: 'some_name' });
        const result = await matchBotModel.setMatchBot(params);
        const matchBots = await MatchBot.find();

        expect(result).to.be.true;
        expect(matchBots.length).to.be.eq(2);
      });

      it('create two sponsors', async () => {
        await MatchBotFactory.Create({ bot_name: params.bot_name, sponsor: 'some_name' });
        const result = await matchBotModel.setMatchBot(params);
        const matchBots = await MatchBot.find();

        expect(result).to.be.true;
        expect(matchBots.length).to.be.eq(1);
        expect(matchBots[0].sponsors.length).to.be.eq(2);
      });
    });
    describe('update', async () => {
      it('update match bot voting percent', async () => {
        await MatchBotFactory.Create(params);
        params.voting_percent = 0.1;
        const result = await matchBotModel.setMatchBot(params);
        const matchBots = await MatchBot.find();

        expect(result).to.be.true;
        expect(matchBots.length).to.be.eq(1);
        expect(matchBots[0].sponsors[0].voting_percent).to.be.eq(0.1);
      });

      it('update match bot expiredAt to valid value', async () => {
        await MatchBotFactory.Create(params);
        params.voting_percent = 0.1;
        params.expiredAt = moment().add(2, 'days').startOf('day').toDate();
        const result = await matchBotModel.setMatchBot(params);
        const matchBots = await MatchBot.find();

        expect(result).to.be.true;
        expect(matchBots.length).to.be.eq(1);
        expect(matchBots[0].sponsors[0].expiredAt).to.be.eql(moment().add(2, 'days').startOf('day').toDate());
      });

      it('update match bot expiredAt to null', async () => {
        await MatchBotFactory.Create(params);
        params.voting_percent = 0.1;
        params.expiredAt = null;
        const result = await matchBotModel.setMatchBot(params);
        const matchBots = await MatchBot.find();

        expect(result).to.be.true;
        expect(matchBots.length).to.be.eq(1);
        expect(matchBots[0].sponsors[0].expiredAt).to.be.null;
      });

      it('update match bot null expiredAt to valid Value', async () => {
        params.expiredAt = null;
        await MatchBotFactory.Create(params);
        params.voting_percent = 0.1;
        params.expiredAt = moment().add(2, 'days').startOf('day').toDate();
        const result = await matchBotModel.setMatchBot(params);
        const matchBots = await MatchBot.find();

        expect(result).to.be.true;
        expect(matchBots.length).to.be.eq(1);
        expect(matchBots[0].sponsors[0].expiredAt).to.be.eql(moment().add(2, 'days').startOf('day').toDate());
      });

      it('update match bot enabled', async () => {
        params.enabled = true;
        await MatchBotFactory.Create(params);
        params.enabled = false;
        const result = await matchBotModel.setMatchBot(params);
        const matchBots = await MatchBot.find();

        expect(result).to.be.true;
        expect(matchBots.length).to.be.eq(1);
        expect(matchBots[0].sponsors[0].enabled).to.be.false;
      });

      it('update match bot note', async () => {
        params.note = '';
        await MatchBotFactory.Create(params);
        params.note = 'some text';
        const result = await matchBotModel.setMatchBot(params);
        const matchBots = await MatchBot.find();

        expect(result).to.be.true;
        expect(matchBots.length).to.be.eq(1);
        expect(matchBots[0].sponsors[0].note).to.be.eq(params.note);
        expect(matchBots[0].sponsors[0].enabled).to.be.true;
      });

      it('update match bot data with many sponsors', async () => {
        await MatchBotFactory.Create(params);
        await matchBotModel.setMatchBot({ bot_name: params.bot_name, sponsor: 'some_sponsor1' });
        await matchBotModel.setMatchBot({ bot_name: params.bot_name, sponsor: 'some_sponsor2' });
        await matchBotModel.setMatchBot(params);
        params.voting_percent = 0.1;
        const result = await matchBotModel.setMatchBot(params);
        const matchBots = await MatchBot.find();

        expect(result).to.be.true;
        expect(matchBots.length).to.be.eq(1);
        expect(matchBots[0].sponsors[0].voting_percent).to.be.eq(0.1);
        expect(matchBots[0].sponsors[0].sponsor_name).to.be.eq(params.sponsor);
      });

      it('not update match bot with < 0 voting percent', async () => {
        await MatchBotFactory.Create(params);
        params.voting_percent = -0.1;
        const result = await matchBotModel.setMatchBot(params);

        expect(result).to.be.false;
      });

      it('not update match bot with > 1 voting percent', async () => {
        await MatchBotFactory.Create(params);
        params.voting_percent = 1.1;
        const result = await matchBotModel.setMatchBot(params);

        expect(result).to.be.false;
      });
    });
  });
  describe('remove', async () => {
    let bot_name, expiredAt;

    beforeEach(async () => {
      await dropDatabase();
      bot_name = 'bot1';
      expiredAt = moment().utc().add(1, 'days').startOf('date')
        .toDate();

      await MatchBotFactory.Create({
        bot_name,
        sponsors: [
          { sponsor_name: 'sponsor1', enabled: true, expiredAt },
          { sponsor_name: 'sponsor2', enabled: true, expiredAt },
        ],
        expiredAt,
      });
    });
    it('should remove rule with valid params', async () => {
      const result = await matchBotModel.removeRule({ bot_name, sponsor: 'sponsor1' });
      const matchBot = await MatchBot.findOne({ bot_name });

      expect(result).to.be.true;
      expect(matchBot.sponsors.length).to.be.eq(1);
    });

    it('should not remove rule with invalid sponsor', async () => {
      const result = await matchBotModel.removeRule({ bot_name, sponsor: 'aaaa' });
      const matchBot = await MatchBot.findOne({ bot_name });

      expect(result).to.be.true;
      expect(matchBot.sponsors.length).to.be.eq(2);
    });

    it('should not remove rule with invalid bot name', async () => {
      const result = await matchBotModel.removeRule({ bot_name: 'aa', sponsor: 'sponsor1' });
      const matchBot = await MatchBot.findOne({ bot_name });

      expect(result).to.be.false;
      expect(matchBot.sponsors.length).to.be.eq(2);
    });
  });
  describe('getMatchBots', async () => {
    beforeEach(async () => {
      await dropDatabase();
      const expiredAt = moment().utc().add(1, 'days').startOf('date')
        .toDate();

      await MatchBotFactory.Create({
        bot_name: 'user1',
        sponsors: [
          { sponsor_name: 'sponsor1', enabled: true, expiredAt },
          { sponsor_name: 'sponsor2', enabled: true, expiredAt },
          { sponsor_name: 'sponsor3', enabled: false, expiredAt },
        ],
      });
      await MatchBotFactory.Create({
        bot_name: 'user2',
        sponsors: [
          { sponsor_name: 'sponsor1', enabled: true, expiredAt },
        ],
      });
      await MatchBotFactory.Create({
        bot_name: 'user3',
        sponsors: [
          { sponsor_name: 'sponsor1', enabled: false, expiredAt },
        ],
      });
    });

    it('get match bots by user1 without limit and skip', async () => {
      const { results } = await matchBotModel.getMatchBots({ bot_name: 'user1', skip: 0, limit: 20 });
      expect(results.length).to.be.eq(3);
    });

    it('get match bots by user1 with limit', async () => {
      const { results } = await matchBotModel.getMatchBots({ bot_name: 'user1', limit: 2 });
      expect(results.length).to.be.eq(2);
    });

    it('get match bots by user1 with skip', async () => {
      const { results } = await matchBotModel.getMatchBots({ bot_name: 'user1', skip: 2, limit: 20 });
      expect(results.length).to.be.eq(1);
    });

    it('get match bots by user1 with skip and limit', async () => {
      const { results } = await matchBotModel.getMatchBots({ bot_name: 'user1', skip: 1, limit: 1 });
      expect(results.length).to.be.eq(1);
    });

    it('get match bots by user2 without limit and skip', async () => {
      const { results } = await matchBotModel.getMatchBots({ bot_name: 'user2', skip: 0, limit: 20 });
      expect(results.length).to.be.eq(1);
    });

    it('do not get match bots by not exist user', async () => {
      const { results } = await matchBotModel.getMatchBots({ bot_name: 'some', skip: 0, limit: 20 });
      expect(results.length).to.be.eq(0);
    });

    it('do not get match bots without user', async () => {
      const { results } = await matchBotModel.getMatchBots({ skip: 0, limit: 20 });
      expect(results.length).to.be.eq(0);
    });
  });
  describe('setVotingPower', async () => {
    let bot1, bot2, sponsor1, sponsor2, sponsor3, expiredAt;

    beforeEach(async () => {
      bot1 = 'bot1';
      bot2 = 'bot2';
      sponsor1 = 'sponsor1';
      sponsor2 = 'sponsor2';
      sponsor3 = 'sponsor3';
      expiredAt = moment().utc().add(1, 'days').startOf('date')
        .toDate();
      await dropDatabase();
      await MatchBotFactory.Create({
        bot_name: bot1,
        sponsors: [
          { sponsor_name: sponsor1, enabled: true, expiredAt },
          { sponsor_name: sponsor2, enabled: true, expiredAt },
        ],
      });
      await MatchBotFactory.Create({
        bot_name: bot2,
        sponsors: [
          { sponsor_name: sponsor1, enabled: true, expiredAt },
          { sponsor_name: sponsor2, enabled: true, expiredAt },
          { sponsor_name: sponsor3, enabled: true, expiredAt },
        ],
      });
    });

    it('should update bot rules voting power', async () => {
      const result = await matchBotModel.setVotingPower({ bot_name: bot1, voting_power: 5000 });
      const rules = await MatchBot.find({ bot_name: bot1 });
      const another_rules = await MatchBot.find({ bot_name: bot2 });

      expect(result).to.be.true;
      expect(_.mean(_.map(rules, 'min_voting_power'))).to.be.eq(5000);
      expect(_.mean(_.map(another_rules, 'min_voting_power'))).to.be.eq(8000);
    });

    it('should not update bot rules voting power without voting power', async () => {
      const result = await matchBotModel.setVotingPower({ bot_name: bot1 });
      const rules = await MatchBot.find({ bot_name: bot1 });
      expect(result).to.be.false;
      expect(_.mean(_.map(rules, 'min_voting_power'))).to.be.eq(8000);
    });

    it('should not update bot rules voting power with invalid bot name', async () => {
      const result = await matchBotModel.setVotingPower({ bot_name: 'aa', voting_power: 5000 });
      const rules = await MatchBot.find();
      expect(result).to.be.false;
      expect(_.mean(_.map(rules, 'min_voting_power'))).to.be.eq(8000);
    });
  });
  describe('updateStatus', async () => {
    let bot1, bot2, sponsor1, sponsor2, sponsor3, expiredAt;

    beforeEach(async () => {
      bot1 = 'bot1';
      bot2 = 'bot2';
      sponsor1 = 'sponsor1';
      sponsor2 = 'sponsor2';
      sponsor3 = 'sponsor3';
      expiredAt = moment().utc().add(1, 'days').startOf('date')
        .toDate();
      await dropDatabase();
      await MatchBotFactory.Create({
        bot_name: bot1,
        sponsors: [
          { sponsor_name: sponsor1, enabled: true, expiredAt },
          { sponsor_name: sponsor2, enabled: false, expiredAt },
        ],
      });
      await MatchBotFactory.Create({
        bot_name: bot2,
        sponsors: [
          { sponsor_name: sponsor1, enabled: false, expiredAt },
          { sponsor_name: sponsor2, enabled: false, expiredAt },
          { sponsor_name: sponsor3, enabled: false, expiredAt },
        ],
      });
    });

    it('should update bot rules status to enabled', async () => {
      const result = await matchBotModel.updateStatus({ bot_name: bot1, enabled: true });
      const match_bot = await MatchBot.findOne({ bot_name: bot1 });
      const another_bot = await MatchBot.findOne({ bot_name: bot2 });
      expect(result).to.be.true;
      expect(_.map(match_bot.sponsors, 'enabled')).to.be.eql([true, true]);
      expect(_.map(another_bot.sponsors, 'enabled')).to.be.eql([false, false, false]);
    });

    it('should update bot rules status to disabled', async () => {
      const result = await matchBotModel.updateStatus({ bot_name: bot1, enabled: false });
      const match_bot = await MatchBot.findOne({ bot_name: bot1 });
      expect(result).to.be.true;
      expect(_.map(match_bot.sponsors, 'enabled')).to.be.eql([false, false]);
    });
  });
  describe('inactivateRules', async () => {
    let bot1, bot2, sponsor1, sponsor2, sponsor3, expiredAt;

    beforeEach(async () => {
      bot1 = 'bot1';
      bot2 = 'bot2';
      sponsor1 = 'sponsor1';
      sponsor2 = 'sponsor2';
      sponsor3 = 'sponsor3';
      expiredAt = moment().utc().add(1, 'days').startOf('date')
        .toDate();
      await dropDatabase();
      await MatchBotFactory.Create({
        bot_name: bot1,
        sponsors: [
          { sponsor_name: sponsor1, enabled: true, expiredAt: moment().subtract(1, 'days').toDate() },
          { sponsor_name: sponsor2, enabled: false, expiredAt },
        ],
      });
      await MatchBotFactory.Create({
        bot_name: bot2,
        sponsors: [
          { sponsor_name: sponsor1, enabled: true, expiredAt },
          { sponsor_name: sponsor2, enabled: true, expiredAt: moment().subtract(1, 'days').toDate() },
          { sponsor_name: sponsor3, enabled: false, expiredAt },
        ],
      });
    });

    it('should inactivate expired rules from bot 1', async () => {
      await matchBotModel.inactivateRules();
      const match_bot = await MatchBot.findOne({ bot_name: bot1 });
      expect(match_bot.sponsors[0].enabled).to.be.false;
      expect(match_bot.sponsors[1].enabled).to.be.false;
    });

    it('should inactivate expired rules from bot 2', async () => {
      await matchBotModel.inactivateRules();
      const match_bot = await MatchBot.findOne({ bot_name: bot2 });
      expect(match_bot.sponsors[0].enabled).to.be.true;
      expect(match_bot.sponsors[1].enabled).to.be.false;
      expect(match_bot.sponsors[2].enabled).to.be.false;
    });
  });
});
