const curatorsBot = require('utilities/operations/matchBots/curatorsBot');
const {
  expect, sinon, extendedMatchBotModel, _,
} = require('test/testHelper');

const { ExtendedMatchBotFactory } = require('test/factories');
const { curatorsBotQueue } = require('utilities/redis/queues');
const { getVoteData, getBotData } = require('./mocks');

describe('On processCuratorsMatchBot', async () => {
  afterEach(() => {
    sinon.restore();
  });
  describe('When dont find bots or comment', async () => {
    let result;
    beforeEach(async () => {
      sinon.stub(extendedMatchBotModel, 'find').returns({ result: [] });
      sinon.spy(curatorsBot, 'sendToCuratorsQueue');
      const data = getVoteData();
      result = await curatorsBot.processCuratorsMatchBot(data);
    });
    it('should return false result when not found bots', async () => {
      expect(result).to.be.deep.eq({ result: false });
    });
    it('should not call sendToCuratorsQueue', async () => {
      const actual = curatorsBot.sendToCuratorsQueue.called;
      expect(actual).to.be.false;
    });
  });
  describe('When bots founded', async () => {
    let bot, data;
    beforeEach(async () => {
      data = getVoteData();
      bot = await ExtendedMatchBotFactory.Create({ onlyData: true });
      sinon.stub(extendedMatchBotModel, 'find').returns({ result: [bot] });
      sinon.spy(curatorsBot, 'sendToCuratorsQueue');
      await curatorsBot.processCuratorsMatchBot(data);
    });
    it('should call sendToCuratorsQueue once', async () => {
      const actual = curatorsBot.sendToCuratorsQueue.calledOnce;
      expect(actual).to.be.true;
    });
    it('should call sendToCuratorsQueue with proper params', async () => {
      const actual = curatorsBot.sendToCuratorsQueue.calledWith({
        vote: data,
        bots: [bot],
      });
      expect(actual).to.be.true;
    });
  });
});

describe('On sendToCuratorsQueue', async () => {
  afterEach(() => {
    sinon.restore();
  });
  describe('On valid data', async () => {
    const counter = _.random(2, 10);
    beforeEach(async () => {
      sinon.spy(curatorsBotQueue, 'send');
      const bots = [];
      for (let i = 0; i < counter; i++) {
        bots.push(getBotData());
      }
      const vote = getVoteData({ weight: _.random(1, 10000) });
      await curatorsBot.sendToCuratorsQueue({ vote, bots });
    });
    it('should call authorsBotQueue send times valid bots array length', async () => {
      const actual = curatorsBotQueue.send.callCount;
      expect(actual).to.be.eq(counter);
    });
    it('should send vote to queue if bot weight negative and bot enable powerDown', async () => {
      await curatorsBot.sendToCuratorsQueue({
        vote: getVoteData({ weight: _.random(-10000, -1) }),
        bots: [getBotData({ enablePowerDown: true })],
      });
      const actual = curatorsBotQueue.send.called;
      expect(actual).to.be.true;
    });
  });
  describe('On invalid data', async () => {
    beforeEach(async () => {
      sinon.spy(curatorsBotQueue, 'send');
    });
    it('should not call on invalid post data', async () => {
      const vote = getVoteData({ remove: _.sample(['author', 'permlink', 'weight']) });
      const bots = [getBotData()];
      await curatorsBot.sendToCuratorsQueue({ vote, bots });

      const actual = curatorsBotQueue.send.called;
      expect(actual).to.be.false;
    });

    it('should not call on invalid bots data', async () => {
      const vote = getVoteData();
      const bots = [getBotData({ remove: _.sample(['minVotingPower', 'voteRatio']) })];
      await curatorsBot.sendToCuratorsQueue({ vote, bots });

      const actual = curatorsBotQueue.send.called;
      expect(actual).to.be.false;
    });

    it('should not call on negative vote without enablePowerDown', async () => {
      const vote = getVoteData({ weight: _.random(-10000, -1) });
      const bots = [getBotData()];
      await curatorsBot.sendToCuratorsQueue({ vote, bots });

      const actual = curatorsBotQueue.send.called;
      expect(actual).to.be.false;
    });
  });
});
