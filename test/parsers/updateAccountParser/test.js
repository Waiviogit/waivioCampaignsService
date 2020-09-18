const {
  accountUpdateParser, dropDatabase, expect, sinon, Constants, MatchBot,
} = require('test/testHelper');
const { MatchBotFactory } = require('test/factories');
const { matchBotModel } = require('models');
const { getMocksData } = require('./mocks');

describe('update account Parser', async () => {
  describe('checkDisable match bot', async () => {
    let accountAuths, spy, bot1, bot2, sponsor1, sponsor2;

    beforeEach(async () => {
      await dropDatabase();
      spy = sinon.spy(matchBotModel, 'updateStatus');
      bot1 = 'bot1';
      bot2 = 'bot2';
      sponsor1 = 'sponsor1';
      sponsor2 = 'sponsor2';
      accountAuths = [[0, process.env.UPVOTE_BOT_NAME], [0, 'bla']];
      const matchBot = await MatchBotFactory.Create({ bot_name: bot1, sponsor: sponsor1, enabled: true });
      await MatchBot.updateOne({ _id: matchBot._id }, { $push: { sponsors: { sponsor_name: sponsor2, voting_percent: 1, enabled: true } } });
      await MatchBotFactory.Create({ bot_name: bot2, sponsor: sponsor1, enabled: true });
    });

    afterEach(() => {
      spy.restore();
    });

    it('should call update status', async () => {
      const { operation } = await getMocksData({ account: bot1, account_auths: [] });

      await accountUpdateParser.parse(operation);
      expect(spy.callCount).to.be.eq(1);
    });

    it('should not call update status with bot auth', async () => {
      const { operation } = await getMocksData({ account: bot1, account_auths: accountAuths });

      await accountUpdateParser.parse(operation);
      expect(spy.callCount).to.be.eq(0);
    });

    it('should not call update status with invalid bot name', async () => {
      const { operation } = await getMocksData({ account: 'aaaa', account_auths: [] });

      await accountUpdateParser.parse(operation);
      expect(spy.callCount).to.be.eq(0);
    });
  });
});
