const {
  expect, voteParser, dropDatabase, faker, ObjectID, sinon, steemHelper, redisSetter, redisGetter,
} = require('test/testHelper');
const moment = require('moment');
const { DOWNVOTE_ON_REVIEW, MATCH_BOT_VOTE } = require('constants/ttlData');
const { CampaignFactory } = require('test/factories');

describe('On vote parser', async () => {
  describe('On parse', async () => {
    let users, guideName, matchBots, user, postPermlink;
    beforeEach(async () => {
      await dropDatabase();
      sinon.spy(redisSetter, 'setSimpleTtl');
      postPermlink = faker.random.string(10);
      guideName = faker.name.firstName();
      const _id = new ObjectID();
      user = faker.name.firstName();
      users = [{
        _id,
        name: user,
        status: 'completed',
        object_permlink: faker.random.string(10),
        hiveCurrency: 0.5,
        completedAt: new Date(),
        permlink: faker.random.string(10),
      }];
      const payments = [{
        reservationId: _id,
        userName: user,
        rootAuthor: user,
        objectPermlink: users[0].object_permlink,
        postTitle: faker.random.string(10),
        postPermlink,
        status: 'active',
      }];
      matchBots = [faker.random.string(10)];
      await CampaignFactory.Create({
        users, payments, guideName, match_bots: matchBots,
      });
    });
    afterEach(() => {
      sinon.restore();
    });
    describe('On parse votes with match bots', async () => {
      it('should call ttl method if vote from guide', async () => {
        await voteParser.parse([{
          voter: guideName, author: user, permlink: postPermlink, weight: 10000,
        }]);
        expect(redisSetter.setSimpleTtl.calledOnce).to.be.true;
      });
      it('should create correct ttl method if vote from guide', async () => {
        await voteParser.parse([{
          voter: guideName, author: user, permlink: postPermlink, weight: 10000,
        }]);
        const result = await redisGetter.getTTLCampaignsData(`${MATCH_BOT_VOTE}|${user}|${postPermlink}`);
        expect(result).to.be.exist;
      });
      it('should call ttl method if vote from match bot', async () => {
        await voteParser.parse([{
          voter: matchBots[0], author: user, permlink: postPermlink, weight: 10000,
        }]);
        expect(redisSetter.setSimpleTtl.calledOnce).to.be.true;
      });
      it('should create correct ttl method if vote from matchBot', async () => {
        await voteParser.parse([{
          voter: guideName, author: user, permlink: postPermlink, weight: 10000,
        }]);
        const result = await redisGetter.getTTLCampaignsData(`${MATCH_BOT_VOTE}|${user}|${postPermlink}`);
        expect(result).to.be.exist;
      });
      it('should not call ttl method with vote from guide from another campaign without payment', async () => {
        const anotherUser = faker.name.firstName();
        await CampaignFactory.Create({
          users: [{
            name: anotherUser,
            status: 'completed',
            object_permlink: faker.random.string(10),
            hiveCurrency: 0.5,
            completedAt: new Date(),
            permlink: faker.random.string(10),
          }],
        });
        await voteParser.parse([{
          voter: guideName, author: anotherUser, permlink: postPermlink, weight: 10000,
        }]);
        expect(redisSetter.setSimpleTtl.notCalled).to.be.true;
      });
    });

    describe('On parse down votes with another users', async () => {
      describe('On new post', async () => {
        beforeEach(async () => {
          sinon.stub(steemHelper, 'getPostInfo').returns(Promise.resolve(
            { author: faker.random.string(), created: moment.utc().subtract(1, 'days').toDate() },
          ));
        });
        it('should not call ttl create method with upvote another user', async () => {
          await voteParser.parse([{
            voter: faker.random.string(10), author: user, permlink: postPermlink, weight: 10000,
          }]);
          expect(redisSetter.setSimpleTtl.notCalled).to.be.true;
        });
        it('should call ttl create method with downvote another user', async () => {
          await voteParser.parse([{
            voter: faker.random.string(10), author: user, permlink: postPermlink, weight: -10000,
          }]);
          expect(redisSetter.setSimpleTtl.calledOnce).to.be.true;
        });
        it('should create ttl for downvote parse with valid params', async () => {
          await voteParser.parse([{
            voter: faker.random.string(10), author: user, permlink: postPermlink, weight: -10000,
          }]);
          const result = await redisGetter.getTTLCampaignsData(`${DOWNVOTE_ON_REVIEW}|${user}|${postPermlink}`);
          expect(result).to.be.exist;
        });
        it('should call ttl create method once with many downvotes for one post', async () => {
          await voteParser.parse([{
            voter: faker.random.string(10), author: user, permlink: postPermlink, weight: -10000,
          }]);
          await voteParser.parse([{
            voter: faker.random.string(10), author: user, permlink: postPermlink, weight: -10000,
          }]);
          expect(redisSetter.setSimpleTtl.calledOnce).to.be.true;
        });
      });
      describe('On old post', async () => {
        beforeEach(async () => {
          sinon.stub(steemHelper, 'getPostInfo').returns(Promise.resolve(
            { author: faker.random.string(), created: moment.utc().subtract(10, 'days').toDate() },
          ));
        });
        it('should not call create ttl method with old post', async () => {
          await voteParser.parse([{
            voter: faker.random.string(10), author: user, permlink: postPermlink, weight: -10000,
          }]);
          expect(redisSetter.setSimpleTtl.notCalled).to.be.true;
        });
      });
    });
  });
});
