const curatorsBot = require('utilities/operations/matchBots/curatorsBot');
const {
  expect, sinon, extendedMatchBotModel,
} = require('test/testHelper');

const { ExtendedMatchBotFactory } = require('test/factories');
const { getVoteData } = require('./mocks');

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
