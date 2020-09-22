const {
  expect, revoteOnPost, dropDatabase, sinon, faker, steemHelper,
} = require('test/testHelper');

describe('On reVoteOnPost', async () => {
  beforeEach(async () => {
    await dropDatabase();
  });
  afterEach(() => {
    sinon.restore();
  });
  describe('without upvotes', async () => {
    beforeEach(async () => {
      sinon.spy(steemHelper, 'getPostInfo');
    });
    it('should not call method to get post info without upvotes', async () => {
      await revoteOnPost({ author: faker.name.firstName(), permlink: faker.random.string(10) });
      expect(steemHelper.getPostInfo.notCalled).to.be.true;
    });
  });
  describe('with post older then 7 days', async () => {
    beforeEach(async () => {
      sinon.stub(steemHelper, 'getPostInfo').returns(Promise.resolve());

    });
  });
  describe('without downvotes on post', async () => {
    beforeEach(async () => {
    });
  });
  describe('with downvotes and pending payout 0', async () => {
    beforeEach(async () => {
    });
  });
});
