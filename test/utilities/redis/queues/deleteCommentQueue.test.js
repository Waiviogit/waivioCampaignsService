const {
  _, expect, sinon, faker, campaignHelper,
} = require('test/testHelper');
const deleteCommentQueue = require('utilities/redis/queues/deleteCommentQueue');
const { mockDeleteQueueData } = require('./mock');

describe('On message', async () => {
  afterEach(() => {
    sinon.restore();
  });
  it('should trigger spy on emit', () => {
    const spy = sinon.spy();
    deleteCommentQueue.on('message', spy);
    deleteCommentQueue.emit('message');
    expect(spy.called).to.be.true;
  });
});

describe('messageHandler', async () => {
  let message, id, next;
  beforeEach(async () => {
    message = mockDeleteQueueData();
    next = () => {};
    id = faker.random.string();
  });
  afterEach(() => {
    sinon.restore();
  });

  it('should return false on wrong data', async () => {
    message = JSON.stringify(_.pick(message, _.sample(['campaignId', 'reservation_permlink'])));
    const result = await deleteCommentQueue.messageHandler(message, next, id);
    expect(result).to.be.eq(false);
  });

  it('should call campaign helper with correct data', async () => {
    const spy = sinon.spy(campaignHelper, 'deleteSponsorObligationsHelper');
    await deleteCommentQueue.messageHandler(JSON.stringify(message), next, id);
    expect(spy.calledWith(message)).to.be.true;
  });

  it('should call del message with correct data', async () => {
    const spy = sinon.spy(deleteCommentQueue, 'del');
    await deleteCommentQueue.messageHandler(JSON.stringify(message), next, id);
    expect(spy.calledWith(id)).to.be.true;
  });
});
