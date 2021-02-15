const { expect, dropDatabase, postModel } = require('test/testHelper');
const { PostFactory } = require('test/factories');

describe('postModel', async () => {
  describe('findOne', async () => {
    let author, permlink;

    beforeEach(async () => {
      await dropDatabase();
      author = 'author';
      permlink = 'permlink';
      await PostFactory.Create({ author, permlink });
    });

    it('return success', async () => {
      const { post } = await postModel.getOne({ author, permlink });

      expect(post).to.be.exist;
    });

    it('not return with invalid permlink', async () => {
      const { post } = await postModel.getOne({ author, permlink: 'aa' });

      expect(post).to.be.not.exist;
    });

    it('not return with invalid author', async () => {
      const { post } = await postModel.getOne({ author: 'aa', permlink });

      expect(post).to.be.not.exist;
    });
  });
});
