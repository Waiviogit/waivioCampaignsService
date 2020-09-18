const {
  customJsonParser, dropDatabase, expect, sinon, steemHelper, Constants, moment, MatchBot,
} = require('test/testHelper');
const { MatchBotFactory } = require('test/factories');
const { matchBotModel } = require('models');
const { getMocksData } = require('./mocks');

describe('custom json Parser', async () => {
  describe('setMatchBot', async () => {
    let spy, bot_name1, sponsor1, sponsor2, voting_percent, note, enabled, accsStub, id, expiredAt;
    let callback = null;

    beforeEach(async () => {
      await dropDatabase();
      id = 'match_bot_set_rule';
      spy = sinon.spy(matchBotModel, 'setMatchBot');
      sponsor1 = 'sponsor1';
      sponsor2 = 'sponsor2';
      bot_name1 = 'bot1';
      voting_percent = 0.1;
      note = '';
      enabled = true;
      expiredAt = moment().utc().add(1, 'days').startOf('date')
        .toDate();
      accsStub = [
        { posting: { account_auths: [[0, Constants.upvoteBot.userName]] } },
        { posting: { account_auths: [] } },
      ];
    });
    afterEach(async () => {
      sinon.restore();
      spy.restore();
    });

    it('should set rule with valid params without previously created', async () => {
      await sinon.stub(steemHelper, 'getAccountsInfo').returns(Promise.resolve(accsStub));
      const json = {
        sponsor: sponsor1, voting_percent, note, enabled, expiredAt,
      };
      const { operation } = await getMocksData({ user: bot_name1, json, id });

      await customJsonParser.parse(operation);
      await Promise.resolve(spy.returnValues[0])
        .then((data) => {
          callback = data;
        });
      expect(spy.callCount).to.be.eq(1);
      expect(callback).to.be.true;
    });

    it('should set rule with voting percent', async () => {
      await sinon.stub(steemHelper, 'getAccountsInfo').returns(Promise.resolve(accsStub));
      const json = {
        sponsor: sponsor1, voting_percent, enabled, expiredAt,
      };
      const { operation } = await getMocksData({ user: bot_name1, json, id });

      await customJsonParser.parse(operation);
      await Promise.resolve(spy.returnValues[0])
        .then((data) => {
          callback = data;
        });
      expect(spy.callCount).to.be.eq(1);
      expect(callback).to.be.true;
    });

    it('should set rule without enabled', async () => {
      await sinon.stub(steemHelper, 'getAccountsInfo').returns(Promise.resolve(accsStub));
      const json = {
        sponsor: sponsor1, voting_percent, note, expiredAt,
      };
      const { operation } = await getMocksData({
        user: bot_name1, json, id, expiredAt,
      });

      await customJsonParser.parse(operation);
      await Promise.resolve(spy.returnValues[0])
        .then((data) => {
          callback = data;
        });
      expect(spy.callCount).to.be.eq(1);
      expect(callback).to.be.true;
    });

    it('should set rule without expiredAt', async () => {
      await sinon.stub(steemHelper, 'getAccountsInfo').returns(Promise.resolve(accsStub));
      const json = { sponsor: sponsor1, voting_percent, note };
      const { operation } = await getMocksData({ user: bot_name1, json, id });

      await customJsonParser.parse(operation);
      await Promise.resolve(spy.returnValues[0])
        .then((data) => {
          callback = data;
        });
      expect(spy.callCount).to.be.eq(1);
      expect(callback).to.be.true;
    });

    it('should not set rule with invalid expiredAt', async () => {
      await sinon.stub(steemHelper, 'getAccountsInfo').returns(Promise.resolve(accsStub));
      const json = {
        sponsor: sponsor1, voting_percent, note, expiredAt: moment().utc().toDate(),
      };
      const { operation } = await getMocksData({ user: bot_name1, json, id });

      await customJsonParser.parse(operation);
      expect(spy.callCount).to.be.eq(0);
    });

    it('should not set rule without voting percent', async () => {
      await sinon.stub(steemHelper, 'getAccountsInfo').returns(Promise.resolve(accsStub));
      const json = {
        sponsor: sponsor1, note, enabled, expiredAt,
      };
      const { operation } = await getMocksData({ user: bot_name1, json, id });

      await customJsonParser.parse(operation);
      await Promise.resolve(spy.returnValues[0])
        .then((data) => {
          callback = data;
        });
      expect(spy.callCount).to.be.eq(1);
      expect(callback).to.be.true;
    });

    it('should not set rule without sponsor', async () => {
      await sinon.stub(steemHelper, 'getAccountsInfo').returns(Promise.resolve(accsStub));
      const json = {
        note, voting_percent, enabled, expiredAt,
      };
      const { operation } = await getMocksData({ user: bot_name1, json, id });

      await customJsonParser.parse(operation);
      await Promise.resolve(spy.returnValues[0])
        .then((data) => {
          callback = data;
        });
      expect(spy.callCount).to.be.eq(0);
    });

    it('should not set rule with invalid id', async () => {
      await sinon.stub(steemHelper, 'getAccountsInfo').returns(Promise.resolve(accsStub));
      const json = {
        sponsor: sponsor1, note, voting_percent, enabled, expiredAt,
      };
      const { operation } = await getMocksData({ user: bot_name1, json });

      await customJsonParser.parse(operation);
      await Promise.resolve(spy.returnValues[0])
        .then((data) => {
          callback = data;
        });
      expect(spy.callCount).to.be.eq(0);
    });

    it('should not set rule without json', async () => {
      await sinon.stub(steemHelper, 'getAccountsInfo').returns(Promise.resolve(accsStub));
      const { operation } = await getMocksData({ user: bot_name1, id });

      await customJsonParser.parse(operation);
      await Promise.resolve(spy.returnValues[0])
        .then((data) => {
          callback = data;
        });
      expect(spy.callCount).to.be.eq(0);
    });
  });
  describe('removeMatchBot', async () => {
    let spy, bot_name, sponsor1, sponsor2, id, expiredAt;
    let callback = null;

    beforeEach(async () => {
      await dropDatabase();
      id = 'match_bot_remove_rule';
      spy = sinon.spy(matchBotModel, 'removeRule');
      bot_name = 'bot1';
      sponsor1 = 'sponsor1';
      sponsor2 = 'sponsor2';

      expiredAt = moment().utc().add(1, 'days').startOf('date')
        .toDate();

      await MatchBotFactory.Create({
        bot_name,
        sponsors: [
          { sponsor_name: sponsor1, enabled: true, expiredAt },
          { sponsor_name: sponsor2, enabled: true, expiredAt },
        ],
        expiredAt,
      });
    });
    afterEach(async () => {
      sinon.restore();
      spy.restore();
    });

    it('should remove rule', async () => {
      const json = { sponsor: sponsor1 };
      const { operation } = await getMocksData({ user: bot_name, json, id });

      await customJsonParser.parse(operation);
      await Promise.resolve(spy.returnValues[0]).then((data) => {
        callback = data;
      });
      expect(spy.callCount).to.be.eq(1);
      expect(callback).to.be.true;
    });

    it('should not remove rule with invalid sponsor name', async () => {
      const json = { sponsor: 'dfsdf' };
      const { operation } = await getMocksData({ user: bot_name, json, id });

      await customJsonParser.parse(operation);
      await Promise.resolve(spy.returnValues[0]).then((data) => {
        callback = data;
      });
      expect(spy.callCount).to.be.eq(1);
      expect(callback).to.be.true;
    });

    it('should not remove rule with invalid bot name', async () => {
      const json = { sponsor: sponsor1 };
      const { operation } = await getMocksData({ user: 'bot2', json, id });

      await customJsonParser.parse(operation);
      await Promise.resolve(spy.returnValues[0]).then((data) => {
        callback = data;
      });
      expect(spy.callCount).to.be.eq(1);
      expect(callback).to.be.false;
    });
  });
  describe('setVotingPower', async () => {
    let spy, bot1, bot2, sponsor1, sponsor2, id;
    let callback = null;

    beforeEach(async () => {
      await dropDatabase();
      id = 'match_bot_change_power';
      spy = sinon.spy(matchBotModel, 'setVotingPower');
      bot1 = 'bot1';
      bot2 = 'bot2';

      sponsor1 = 'sponsor1';
      sponsor2 = 'sponsor2';
      const matchBot = await MatchBotFactory.Create({ bot_name: bot1, sponsor: sponsor1 });
      await MatchBot.updateOne({ _id: matchBot._id }, { $push: { sponsors: { sponsor_name: sponsor2, voting_percent: 1, enabled: false } } });
      await MatchBotFactory.Create({ bot_name: bot2, sponsor: sponsor1 });
    });
    afterEach(async () => {
      spy.restore();
    });

    it('should updated voting power', async () => {
      const json = { voting_power: 2 };
      const { operation } = await getMocksData({ user: bot1, json, id });

      await customJsonParser.parse(operation);
      await Promise.resolve(spy.returnValues[0])
        .then((data) => {
          callback = data;
        });
      expect(spy.callCount).to.be.eq(1);
      expect(callback).to.be.true;
    });

    it('should updated voting power with minimum', async () => {
      const json = { voting_power: 1 };
      const { operation } = await getMocksData({ user: bot1, json, id });

      await customJsonParser.parse(operation);
      await Promise.resolve(spy.returnValues[0])
        .then((data) => {
          callback = data;
        });
      expect(spy.callCount).to.be.eq(1);
      expect(callback).to.be.true;
    });

    it('should updated voting power with maximum', async () => {
      const json = { voting_power: 10000 };
      const { operation } = await getMocksData({ user: bot1, json, id });

      await customJsonParser.parse(operation);
      await Promise.resolve(spy.returnValues[0])
        .then((data) => {
          callback = data;
        });
      expect(spy.callCount).to.be.eq(1);
      expect(callback).to.be.true;
    });

    it('should not updated voting power with more than maximum', async () => {
      const json = { voting_power: 10001 };
      const { operation } = await getMocksData({ user: bot1, json, id });

      await customJsonParser.parse(operation);
      await Promise.resolve(spy.returnValues[0])
        .then((data) => {
          callback = data;
        });
      expect(spy.callCount).to.be.eq(1);
      expect(callback).to.be.false;
    });

    it('should not updated voting power with less than minimum', async () => {
      const json = { voting_power: 0.9 };
      const { operation } = await getMocksData({ user: bot1, json, id });

      await customJsonParser.parse(operation);
      await Promise.resolve(spy.returnValues[0])
        .then((data) => {
          callback = data;
        });
      expect(spy.callCount).to.be.eq(1);
      expect(callback).to.be.false;
    });

    it('should not updated voting power without voting power', async () => {
      const json = { };
      const { operation } = await getMocksData({ user: bot1, json, id });

      await customJsonParser.parse(operation);
      await Promise.resolve(spy.returnValues[0])
        .then((data) => {
          callback = data;
        });
      expect(spy.callCount).to.be.eq(0);
    });

    it('should not updated voting power wit invalid id', async () => {
      const json = { voting_power: 3 };
      const { operation } = await getMocksData({ user: bot1, json });

      await customJsonParser.parse(operation);
      await Promise.resolve(spy.returnValues[0])
        .then((data) => {
          callback = data;
        });
      expect(spy.callCount).to.be.eq(0);
    });
  });
});
