const {
  expect, revoteOnPost, dropDatabase, sinon, faker, steemHelper,
  _, matchBotModel, BotUpvote, matchBotHelper,
} = require('test/testHelper');
const moment = require('moment');
const { BOT_UPVOTE_STATUSES } = require('constants/constants');
const { BotUpvoteFactory, MatchBotFactory } = require('test/factories');

describe('On reVoteOnPost', async () => {
  beforeEach(async () => {
    await dropDatabase();
    sinon.stub(steemHelper, 'likePost').returns(Promise.resolve({ result: true }));
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
  describe('with post older then 7 days or without downvotes', async () => {
    let author, permlink;
    beforeEach(async () => {
      author = faker.name.firstName();
      permlink = faker.random.string(10);
      await BotUpvoteFactory.Create({
        bot_name: faker.name.firstName(), author, permlink, status: BOT_UPVOTE_STATUSES.UPVOTED,
      });
      sinon.spy(_, 'map');
      sinon.spy(_, 'sumBy');
    });
    it('should return from method with old post', async () => {
      sinon.stub(steemHelper, 'getPostInfo').returns(Promise.resolve({ author, created: moment.utc().subtract(10, 'day').toDate() }));
      await revoteOnPost({ author, permlink });
      expect(_.map.notCalled).to.be.true;
    });
    it('should return from method without downvotes', async () => {
      sinon.stub(steemHelper, 'getPostInfo').returns(Promise.resolve(
        { author, created: moment.utc().subtract(4, 'day').toDate(), active_votes: [] },
      ));
      await revoteOnPost({ author, permlink });
      expect(_.sumBy.calledOnce).to.be.true;
    });
  });

  describe('with downvotes and pending payout 0', async () => {
    let author, permlink, botName;
    beforeEach(async () => {
      author = faker.name.firstName();
      permlink = faker.random.string(10);
      botName = faker.random.string(10);
      await BotUpvoteFactory.Create({
        bot_name: botName, author, permlink, status: BOT_UPVOTE_STATUSES.UPVOTED,
      });
      sinon.stub(steemHelper, 'getPostInfo').returns(Promise.resolve({
        author,
        created: moment.utc().subtract(4, 'day').toDate(),
        active_votes: [{ voter: faker.name.firstName(), percent: _.random(-100, -300), rshares: _.random(-100, -300) }],
        pending_payout_value: '0.000 HIVE',
      }));
    });
    it('should call like post method once', async () => {
      await revoteOnPost({ author, permlink });
      expect(steemHelper.likePost.calledOnce).to.be.true;
    });
    it('should call like method with correct params', async () => {
      await revoteOnPost({ author, permlink });
      expect(steemHelper.likePost.calledWith({
        key: process.env.UPVOTE_BOT_KEY, voter: botName, author, permlink, weight: 0,
      })).to.be.true;
    });
    it('should call twice with 2 matchBots', async () => {
      await BotUpvoteFactory.Create({
        bot_name: faker.random.string(), author, permlink, status: BOT_UPVOTE_STATUSES.UPVOTED,
      });
      await revoteOnPost({ author, permlink });
      expect(steemHelper.likePost.calledTwice).to.be.true;
    });
  });

  describe('toVote on post', async () => {
    let author, permlink, totalVotesWeight;
    beforeEach(async () => {
      sinon.stub(steemHelper, 'getCurrentPriceInfo').returns(Promise.resolve({ currentPrice: 0.2 }));
      totalVotesWeight = 10;
      author = faker.name.firstName();
      permlink = faker.random.string(10);
      // bot1 = await MatchBotFactory.Create();
      // bot2 = await MatchBotFactory.Create({ sponsor: bot1.sponsors[0].sponsor_name });
      // const names = [bot1.bot_name, bot2.bot_name];
      // for (const name of names) {
      //   await BotUpvoteFactory.Create({
      //     bot_name: name,
      //     sponsor: bot1.sponsors[0].sponsor_name,
      //     author,
      //     permlink,
      //     votePercent: 5000,
      //     currentVote: totalVotesWeight / names.length,
      //     status: BOT_UPVOTE_STATUSES.UPVOTED,
      //     totalVotesWeight,
      //   });
      // }
    });
    describe('with small toVote value', async () => {
      beforeEach(async () => {
        const bot = await MatchBotFactory.Create();
        await BotUpvoteFactory.Create({
          bot_name: bot.bot_name,
          sponsor: bot.sponsors[0].sponsor_name,
          author,
          permlink,
          votePercent: 5000,
          currentVote: 2,
          status: BOT_UPVOTE_STATUSES.UPVOTED,
          totalVotesWeight,
        });
        sinon.stub(steemHelper, 'getPostInfo').returns(Promise.resolve({
          author,
          created: moment.utc().subtract(4, 'day').toDate(),
          active_votes: [
            { voter: faker.name.firstName(), percent: -500, rshares: -99 },
            { voter: faker.name.firstName(), percent: 5000, rshares: 100000 },
            { voter: faker.name.firstName(), percent: 5000, rshares: 100000 },
          ],
          pending_payout_value: '3.942 HBD',
        }));
      });
      it('should not call find matchbot method with small toVoteValue', async () => {
        sinon.spy(matchBotModel, 'find');
        await revoteOnPost({ author, permlink });
        expect(matchBotModel.find.notCalled).to.be.true;
      });
    });
    describe('without matchBot permissions', async () => {
      let bot;
      beforeEach(async () => {
        bot = await MatchBotFactory.Create({ enabled: false });
        await BotUpvoteFactory.Create({
          bot_name: bot.bot_name,
          sponsor: bot.sponsors[0].sponsor_name,
          currentVote: 6.4,
          totalVotesWeight: 6.4,
          author,
          permlink,
          status: BOT_UPVOTE_STATUSES.UPVOTED,
        });
        sinon.stub(steemHelper, 'getPostInfo').returns(Promise.resolve({
          author,
          created: moment.utc().subtract(4, 'day').toDate(),
          active_votes: [
            { voter: faker.name.firstName(), percent: -500, rshares: -1000 },
            { voter: bot.bot_name, percent: 5000, rshares: 100000 },
          ],
          pending_payout_value: '1.942 HBD',
        }));
      });
      it('should not revote without permissions', async () => {
        await revoteOnPost({ author, permlink });
        expect(steemHelper.likePost.notCalled).to.be.true;
      });
    });
    describe('with available toVote value <50% of all value', async () => {
      let bot, upvote;
      beforeEach(async () => {
        bot = await MatchBotFactory.Create();
        upvote = await BotUpvoteFactory.Create({
          bot_name: bot.bot_name,
          sponsor: bot.sponsors[0].sponsor_name,
          votePercent: 8000,
          currentVote: 6.4,
          totalVotesWeight: 6.4,
          author,
          permlink,
          status: BOT_UPVOTE_STATUSES.UPVOTED,
        });
        sinon.stub(steemHelper, 'getPostInfo').returns(Promise.resolve({
          author,
          created: moment.utc().subtract(4, 'day').toDate(),
          active_votes: [
            { voter: faker.name.firstName(), percent: -500, rshares: -20000 },
            { voter: bot.bot_name, percent: 5000, rshares: 40000 },
          ],
          pending_payout_value: '1.942 HBD',
        }));
      });
      it('not toVote if bot vote by 100%', async () => {
        await BotUpvote.updateOne({ _id: upvote._id }, { votePercent: 10000 });
        await revoteOnPost({ author, permlink });
        expect(steemHelper.likePost.notCalled).to.be.true;
      });
      it('should call like method if available toVote <50% of all value', async () => {
        sinon.stub(steemHelper, 'getVotingInfo').returns(Promise.resolve({ voteWeight: upvote.currentVote + 1 }));
        sinon.spy(matchBotHelper, 'getNeededVoteWeight');
        await revoteOnPost({ author, permlink });
        expect(steemHelper.likePost.calledOnce && matchBotHelper.getNeededVoteWeight.notCalled)
          .to.be.true;
      });
      it('should call like method with valid params if available toVote <50% of all value ', async () => {
        sinon.stub(steemHelper, 'getVotingInfo').returns(Promise.resolve({ voteWeight: upvote.currentVote + 1 }));
        await revoteOnPost({ author, permlink });
        expect(steemHelper.likePost.calledWith({
          key: process.env.UPVOTE_BOT_KEY, voter: bot.bot_name, author, permlink, weight: 0,
        })).to.be.true;
      });
    });
    describe('with available toVote value >50% of all value', async () => {
      describe('with many bots, and one of it have voteWeight> toVoteValue', async () => {
        let bot1, bot2;
        beforeEach(async () => {
          bot1 = await MatchBotFactory.Create();
          bot2 = await MatchBotFactory.Create({ sponsor: bot1.sponsors[0].sponsor_name });
          totalVotesWeight = 15;
          const bots = [{ name: bot1.bot_name, weight: 8 }, { name: bot2.bot_name, weight: 10 }];
          for (const bot of bots) {
            await BotUpvoteFactory.Create({
              bot_name: bot.name,
              sponsor: bot1.sponsors[0].sponsor_name,
              author,
              permlink,
              votePercent: 5000,
              currentVote: bot.weight,
              status: BOT_UPVOTE_STATUSES.UPVOTED,
              totalVotesWeight,
            });
          }
          sinon.stub(steemHelper, 'getPostInfo').returns(Promise.resolve({
            author,
            created: moment.utc().subtract(4, 'day').toDate(),
            active_votes: [
              { voter: faker.name.firstName(), percent: -500, rshares: -30000 },
              { voter: bot1.bot_name, percent: 5000, rshares: 40000 },
              { voter: bot2.bot_name, percent: 5000, rshares: 40000 },
            ],
            pending_payout_value: '1.942 HBD',
          }));
        });
        it('should like once if current vote>toVoteValue', async () => {
          sinon.stub(steemHelper, 'getVotingInfo').returns(Promise.resolve({ voteWeight: 20 }));
          sinon.stub(matchBotHelper, 'getNeededVoteWeight').returns(Promise.resolve({ votePower: 1000 }));
          await revoteOnPost({ author, permlink });
          expect(steemHelper.likePost.calledOnce).to.be.true;
        });
        it('should like with correct params if current vote>toVoteValue', async () => {
          sinon.stub(steemHelper, 'getVotingInfo').returns(Promise.resolve({ voteWeight: 20 }));
          sinon.stub(matchBotHelper, 'getNeededVoteWeight').returns(Promise.resolve({ votePower: 1000 }));
          await revoteOnPost({ author, permlink });
          expect(steemHelper.likePost.calledWith({
            key: process.env.UPVOTE_BOT_KEY, voter: bot1.bot_name, author, permlink, weight: 1000,
          })).to.be.true;
        });
        it('should like all of bots if bots vote weight < toVoteValue', async () => {
          sinon.stub(steemHelper, 'getVotingInfo').returns(Promise.resolve({ voteWeight: 11 }));
          await revoteOnPost({ author, permlink });
          expect(steemHelper.likePost.calledTwice).to.be.true;
        });
      });
    });
  });
});
