const {
  ExtendedMatchBot, expect, dropDatabase, _, moment, extendedMatchBotModel, faker,
} = require('test/testHelper');
const { ExtendedMatchBotFactory } = require('test/factories');
const { MATCH_BOT_TYPES } = require('constants/matchBotsData');

describe('On extendedMatchBotModel', async () => {
  beforeEach(async () => {
    await dropDatabase();
  });
  describe('On find', async () => {
    describe('On Error', async () => {
      it('should error exist', async () => {
        const { error } = await extendedMatchBotModel.find(faker.random.string());
        expect(error.message).to.exist;
      });
    });
    describe('On Success', async () => {
      const botCount = _.random(2, 9);
      const botType = _.sample(Object.values(MATCH_BOT_TYPES));
      beforeEach(async () => {
        for (let i = 0; i < botCount; i++) {
          await ExtendedMatchBotFactory.Create({ type: botType });
        }
      });
      it('should find proper amount bots', async () => {
        const { result } = await extendedMatchBotModel.find({ type: botType });
        expect(result.length).to.be.eq(botCount);
      });
      it('should select proper bots keys', async () => {
        const { result } = await extendedMatchBotModel.find({}, { botName: 1, type: 1, _id: 0 });
        _.forEach(result, (bot) => {
          expect(bot).to.have.all.keys('botName', 'type');
        });
      });
    });
  });
  describe('On findOne', async () => {
    describe('On Error', async () => {
      it('should error exist', async () => {
        const { error } = await extendedMatchBotModel.findOne(faker.random.string());
        expect(error.message).to.exist;
      });
    });
    describe('On Success', async () => {
      const botName = faker.random.string();
      const type = _.sample(Object.values(MATCH_BOT_TYPES));
      let bot;
      beforeEach(async () => {
        bot = await ExtendedMatchBotFactory.Create({ botName, type });
      });
      it('should find proper bot', async () => {
        const { result } = await extendedMatchBotModel.findOne({ type, botName });
        expect(result).to.be.deep.eq(bot);
      });
      it('should select proper bot keys', async () => {
        const { result } = await extendedMatchBotModel.findOne(
          { type, botName },
          { botName: 1, type: 1, _id: 0 },
        );
        expect(result).to.have.all.keys('botName', 'type');
      });
    });
  });
  describe('On updateStatus', async () => {
    const counter = _.random(2, 9);
    const type = _.sample(Object.values(MATCH_BOT_TYPES));
    const botEnabledAccName = faker.random.string();
    const botdisabledAccName = faker.random.string();
    beforeEach(async () => {
      const accounts = [];
      for (let i = 0; i < counter; i++) {
        accounts.push({
          name: faker.random.string(),
          minVotingPower: _.random(2, 9),
          enabled: true,
        });
      }
      await ExtendedMatchBotFactory.Create({ botName: botEnabledAccName, type, accounts });
      await ExtendedMatchBotFactory.Create({
        accounts: _.map(accounts, (el) => ({ enabled: false, ...el })),
        botName: botdisabledAccName,
        type,
      });
    });

    it('should update all enabled to false', async () => {
      await extendedMatchBotModel.updateStatus(
        { botName: botEnabledAccName, type, enabled: false },
      );
      const result = await ExtendedMatchBot.findOne({ botName: botEnabledAccName, type }).lean();
      _.forEach(result.accounts, (acc) => {
        expect(acc.enabled).to.be.eq(false);
      });
    });

    it('should update all enabled to true', async () => {
      await extendedMatchBotModel.updateStatus(
        { botName: botdisabledAccName, type, enabled: true },
      );
      const result = await ExtendedMatchBot.findOne({ botName: botdisabledAccName, type }).lean();
      _.forEach(result.accounts, (acc) => {
        expect(acc.enabled).to.be.eq(true);
      });
    });
  });
  describe('On unsetMatchBot', async () => {
    const counter = _.random(2, 9);
    const type = _.sample(Object.values(MATCH_BOT_TYPES));
    const botName = faker.random.string();
    const accName = faker.random.string();
    beforeEach(async () => {
      const accounts = [];
      for (let i = 0; i < counter; i++) {
        accounts.push({
          name: i === 0 ? accName : faker.random.string(),
          minVotingPower: _.random(2, 9),
          enabled: true,
        });
      }
      await ExtendedMatchBotFactory.Create({ botName, type, accounts });
      await extendedMatchBotModel.unsetMatchBot({ botName, type, name: accName });
    });
    it('should remove accName from accounts', async () => {
      const result = await ExtendedMatchBot.findOne({ botName, type }).lean();
      expect(_.map(result, 'name')).to.not.include(accName);
    });
  });

  describe('On createMatchBot', async () => {
    describe('On Success', async () => {
      let botData, result;
      beforeEach(async () => {
        botData = await ExtendedMatchBotFactory.Create({ createData: true });
        const { botName, type } = botData;
        await extendedMatchBotModel.createMatchBot(botData);
        result = await ExtendedMatchBot.findOne({ botName, type }).lean();
      });
      it('should create bot with proper name', async () => {
        expect(result.botName).to.be.eq(botData.botName);
      });
      it('should create bot with proper type', async () => {
        expect(result.type).to.be.eq(botData.type);
      });
      it('should create bot with proper account', async () => {
        const actual = _.omit(result.accounts[0], ['_id', 'enablePowerDown']);
        const expected = _.omit(botData, ['type', 'botName']);
        expect(actual).to.be.deep.eq(expected);
      });
    });
    describe('On Error', async () => {
      it('should return false on not valid data', async () => {
        const botData = await ExtendedMatchBotFactory.Create({ createData: true, type: { } });
        const result = await extendedMatchBotModel.createMatchBot(botData);
        expect(result).to.be.eq(false);
      });
    });
  });

  describe('On updateMatchBot', async () => {
    // describe('On Success', async () => {
    //   let botData, updateData, result;
    //   beforeEach(async () => {
    //     botData = await ExtendedMatchBotFactory.Create();
    //     updateData = await ExtendedMatchBotFactory.Create();
    //     const { botName, type } = botData;
    //     await extendedMatchBotModel.createMatchBot(botData);
    //     result = await ExtendedMatchBot.findOne({ botName, type }).lean();
    //   });
    //   it('should create bot with proper name', async () => {
    //     expect(result.botName).to.be.eq(botData.botName);
    //   });
    //   it('should create bot with proper type', async () => {
    //     expect(result.type).to.be.eq(botData.type);
    //   });
    //   it('should create bot with proper account', async () => {
    //     const actual = _.omit(result.accounts[0], ['_id', 'enablePowerDown']);
    //     const expected = _.omit(botData, ['type', 'botName']);
    //     expect(actual).to.be.deep.eq(expected);
    //   });
    // });
    // describe('On Error', async () => {
    //   it('should return false on not valid data', async () => {
    //     const botData = await ExtendedMatchBotFactory.Create({ createData: true, type: { } });
    //     const result = await extendedMatchBotModel.createMatchBot(botData);
    //     expect(result).to.be.eq(false);
    //   });
    // });
  });
});
