const authorsBot = require('utilities/operations/matchBots/authorsBot');
const {
  expect, sinon, faker, extendedMatchBotModel, _,
} = require('test/testHelper');
const { authorsBotQueue } = require('utilities/redis/queues');

const { ExtendedMatchBotFactory } = require('test/factories');
const { getPostData, getBotData } = require('./mocks');

describe('On processAuthorsMatchBot', async () => {
  afterEach(() => {
    sinon.restore();
  });
  describe('When dont find bots or comment', async () => {
    let result;
    beforeEach(async () => {
      sinon.stub(extendedMatchBotModel, 'find').returns({ result: [] });
      sinon.spy(authorsBot, 'sendToAuthorsQueue');
      const data = getPostData();
      result = await authorsBot.processAuthorsMatchBot(data);
    });
    it('should return false result when not found bots', async () => {
      expect(result).to.be.deep.eq({ result: false });
    });
    it('should return false result when parent_author not empty', async () => {
      const data = getPostData({ parent_author: faker.random.string() });
      result = await authorsBot.processAuthorsMatchBot(data);
      expect(result).to.be.deep.eq({ result: false });
    });
    it('should not call sendToAuthorsQueue', async () => {
      const actual = authorsBot.sendToAuthorsQueue.called;
      expect(actual).to.be.false;
    });
  });
  describe('When bots founded', async () => {
    let bot, data;
    beforeEach(async () => {
      data = getPostData();
      bot = await ExtendedMatchBotFactory.Create({ onlyData: true });
      sinon.stub(extendedMatchBotModel, 'find').returns({ result: [bot] });
      sinon.spy(authorsBot, 'sendToAuthorsQueue');
      await authorsBot.processAuthorsMatchBot(data);
    });
    it('should call sendToAuthorsQueue once', async () => {
      const actual = authorsBot.sendToAuthorsQueue.calledOnce;
      expect(actual).to.be.true;
    });
    it('should call sendToAuthorsQueue with proper params', async () => {
      const actual = authorsBot.sendToAuthorsQueue.calledWith({
        post: data,
        bots: [bot],
      });
      expect(actual).to.be.true;
    });
  });
});

describe('On sendToAuthorsQueue', async () => {
  afterEach(() => {
    sinon.restore();
  });
  describe('On valid data', async () => {
    const counter = _.random(2, 10);
    beforeEach(async () => {
      sinon.spy(authorsBotQueue, 'send');
      const bots = [];
      for (let i = 0; i < counter; i++) {
        bots.push(getBotData());
      }
      const post = getPostData();
      await authorsBot.sendToAuthorsQueue({ post, bots });
    });
    it('should call authorsBotQueue send times valid bots array length', async () => {
      const actual = authorsBotQueue.send.callCount;
      expect(actual).to.be.eq(counter);
    });
  });
  describe('On invalid data', async () => {
    beforeEach(async () => {
      sinon.spy(authorsBotQueue, 'send');
    });
    it('should not call on invalid post data', async () => {
      const post = getPostData({ remove: _.sample(['author', 'permlink']) });
      const bots = [getBotData()];
      await authorsBot.sendToAuthorsQueue({ post, bots });

      const actual = authorsBotQueue.send.called;
      expect(actual).to.be.false;
    });

    it('should not call on invalid bots data', async () => {
      const post = getPostData();
      const bots = [getBotData({ remove: _.sample(['minVotingPower', 'voteWeight']) })];
      await authorsBot.sendToAuthorsQueue({ post, bots });

      const actual = authorsBotQueue.send.called;
      expect(actual).to.be.false;
    });
  });
});
