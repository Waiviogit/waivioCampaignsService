const {
  expirationHelper, expect, sinon, dropDatabase, ObjectID,
  steemHelper, PaymentHistory, faker, BotUpvote, _, Campaign, moment, redisSetter,
} = require('test/testHelper');
const {
  CampaignFactory, PaymentHistoryFactory, BotUpvoteFactory, UserFactory,
} = require('test/factories');

describe('expirationHelper', async () => {
  describe('expire campaign payment data', async () => {
    let campaign, author, payment;
    beforeEach(async () => {
      author = faker.name.firstName();
      campaign = await CampaignFactory.Create({ status: 'active' });
      await CampaignFactory.Create({ guideName: campaign.guideName, status: 'active' });
      payment = await PaymentHistoryFactory.Create({
        type: 'review', sponsor: campaign.guideName, userName: author, payed: true,
      });
      await redisSetter.saveTTL(`expire:paymentDebt|${payment._id.toString()}`, 1, campaign._id.toString());
    });
    it('should not change campaign status if payment payed', async () => {
      await new Promise((resolve) => setTimeout(resolve, 1500));
      const result = await Campaign.findOne({ _id: campaign._id }).lean();
      expect(result.status).to.be.eq('active');
    });
    it('should change campaign status if payment active', async () => {
      await PaymentHistory.updateOne({ _id: payment._id }, { payed: false });
      await new Promise((resolve) => setTimeout(resolve, 1500));
      const campaigns = await Campaign.find({ guideName: campaign.guideName }).lean();
      const result = _.uniq(_.map(campaigns, 'status'));
      expect(result).to.be.deep.eq(['suspended']);
    });
  });
  describe('expireDemoPost', async () => {
    let postStub, author, permlink;
    beforeEach(async () => {
      await dropDatabase();
      postStub = {
        total_payout_value: '3.34 SBD', beneficiaries: [{ account: process.env.POWER_ACC_NAME, weight: 10000 }], curator_payout_value: '3.34 SBD', json_metadata: JSON.stringify({ comment: { userId: 'demoUser' } }),
      };
      sinon.stub(steemHelper, 'getPostInfo').returns(Promise.resolve(postStub));
      sinon.stub(steemHelper, 'getPostAuthorReward').returns(Promise.resolve(2));
      author = 'author';
      permlink = 'permlink';
    });
    afterEach(() => {
      sinon.restore();
    });
    it('check payment type', async () => {
      await expirationHelper.expireDemoPost({ author, permlink });
      const paymentHistories = await PaymentHistory.find();
      expect(paymentHistories.length).to.be.eq(1);
      expect(paymentHistories[0].is_demo_account).to.be.eq(true);
      expect(paymentHistories[0].type).to.be.eq('demo_post');
    });
    it('check payment amount', async () => {
      await expirationHelper.expireDemoPost({ author, permlink });
      const paymentHistories = await PaymentHistory.find();
      expect(paymentHistories[0].amount).to.be.exist;
    });
    it('check payment user name', async () => {
      await expirationHelper.expireDemoPost({ author, permlink });
      const paymentHistories = await PaymentHistory.find();
      expect(paymentHistories[0].userName).to.be.eq('demoUser');
    });
    it('check payment sponsor', async () => {
      await expirationHelper.expireDemoPost({ author, permlink });
      const paymentHistories = await PaymentHistory.find();
      expect(paymentHistories[0].sponsor).to.be.eq('author');
    });
    it('check payment details', async () => {
      await expirationHelper.expireDemoPost({ author, permlink });
      const paymentHistories = await PaymentHistory.find();
      expect(paymentHistories[0].details.post_permlink).to.be.eq('permlink');
    });

    it('check payment record with null reward', async () => {
      sinon.restore();
      postStub.total_payout_value = '0.00 SBD';
      sinon.stub(steemHelper, 'getPostInfo').returns(Promise.resolve(postStub));
      sinon.stub(steemHelper, 'getPostAuthorReward').returns(Promise.resolve(0));
      await expirationHelper.expireDemoPost({ author, permlink });
      const paymentHistories = await PaymentHistory.find();
      expect(paymentHistories.length).to.be.eq(0);
    });
  });

  describe('Expire demoPost with realHive account', async () => {
    let realHive, postStub;
    beforeEach(async () => {
      realHive = faker.name.firstName();
      await dropDatabase();
      const user = await UserFactory.Create(
        { userMetadata: { settings: { hiveBeneficiaryAccount: realHive } } },
      );
      postStub = { total_payout_value: '3.34 SBD', curator_payout_value: '3.34 SBD', json_metadata: JSON.stringify({ comment: { userId: user.name } }) };
      sinon.stub(steemHelper, 'getPostInfo').returns(Promise.resolve(postStub));
      sinon.stub(steemHelper, 'getPostAuthorReward').returns(Promise.resolve(2));
    });
    afterEach(async () => {
      sinon.restore();
    });
    it('should not create debt with realHive account', async () => {
      await expirationHelper.expireDemoPost(
        { author: faker.name.firstName(), permlink: faker.random.string() },
      );
      const paymentHistories = await PaymentHistory.find();
      expect(paymentHistories.length).to.be.eq(0);
    });
  });

  describe('Expire demoPost without realHive account and beneficiarieswithout hPower', async () => {
    let postStub, user;
    beforeEach(async () => {
      user = faker.name.firstName();
      await dropDatabase();
      postStub = {
        total_payout_value: '3.34 SBD',
        curator_payout_value: '3.34 SBD',
        json_metadata: JSON.stringify({ comment: { userId: user } }),
        beneficiaries: [{ account: process.env.POWER_ACC_NAME, weight: 5000 }],
      };
      sinon.stub(steemHelper, 'getPostInfo').returns(Promise.resolve(postStub));
      sinon.stub(steemHelper, 'getPostAuthorReward').returns(Promise.resolve(2));
      await expirationHelper.expireDemoPost(
        { author: faker.name.firstName(), permlink: faker.random.string() },
      );
    });
    afterEach(async () => {
      sinon.restore();
    });
    it('should create debt without realHive account', async () => {
      const paymentHistories = await PaymentHistory.find({ userName: user });
      expect(paymentHistories.length).to.be.eq(1);
    });
    it('should create correct debt for guest user', async () => {
      const paymentHistories = await PaymentHistory.findOne({ userName: user }).lean();
      expect(paymentHistories.amount).to.be.eq(0.5);
    });
  });

  describe('Expire demoPost without realHive account and beneficiaries with hPower', async () => {
    let postStub, user;
    beforeEach(async () => {
      user = faker.name.firstName();
      await dropDatabase();
      postStub = {
        total_payout_value: '3.34 SBD',
        curator_payout_value: '3.34 SBD',
        json_metadata: JSON.stringify({ comment: { userId: user } }),
        beneficiaries: [{ account: 'waivio', weight: 2000 }, { account: process.env.POWER_ACC_NAME, weight: 8000 }],
      };
      sinon.stub(steemHelper, 'getPostInfo').returns(Promise.resolve(postStub));
      sinon.stub(steemHelper, 'getPostAuthorReward').returns(Promise.resolve(2));
      await expirationHelper.expireDemoPost(
        { author: faker.name.firstName(), permlink: faker.random.string() },
      );
    });
    afterEach(async () => {
      sinon.restore();
    });
    it('should create correct debt for guest user with hPower acc', async () => {
      const paymentHistories = await PaymentHistory.findOne({ userName: user }).lean();
      expect(paymentHistories.amount).to.be.eq(0.8);
    });
    it('should create debt without realHive account', async () => {
      const paymentHistories = await PaymentHistory.find({ userName: user });
      expect(paymentHistories.length).to.be.eq(1);
    });
  });

  describe('expireMatchBotRecount', async () => {
    let campaign, reqData, user, requiredObject, paymentData, reviewPayment, benefPayment, users;
    beforeEach(async () => {
      await dropDatabase();
      const _id = new ObjectID();
      user = faker.name.firstName();
      requiredObject = faker.random.string(10);
      users = [{
        _id,
        name: user,
        status: 'completed',
        object_permlink: requiredObject,
        hiveCurrency: 0.5,
        completedAt: new Date(),
        permlink: faker.random.string(10),
      }];
      const payments = [{
        reservationId: _id,
        userName: user,
        rootAuthor: user,
        objectPermlink: requiredObject,
        postTitle: faker.random.string(10),
        postPermlink: faker.random.string(10),
        status: 'active',
      }];
      campaign = await CampaignFactory.Create({ users, payments });
      reqData = {
        author: user,
        permlink: payments[0].postPermlink,
        voter: campaign.guideName,
      };
      paymentData = {
        userName: user,
        sponsor: campaign.guideName,
        main_object: requiredObject,
        amount: 9.45,
        permlink: users[0].permlink,
        reviewPermlink: reqData.permlink,
        reservation_permlink: users[0].permlink,
        beneficiaries: [{
          account: faker.name.firstName(),
          weight: 1000,
        }],
      };
      reviewPayment = await PaymentHistoryFactory.Create(paymentData);
      benefPayment = await PaymentHistoryFactory.Create(Object.assign(paymentData, { type: 'beneficiary_fee', userName: paymentData.beneficiaries[0].account, amount: 1.05 }));
    });
    describe('Without botUpvote', async () => {
      afterEach(async () => {
        sinon.restore();
      });
      describe('with upvote', async () => {
        let result, vote, percent;
        beforeEach(async () => {
          vote = _.random(1, 10);
          percent = _.random(1000, 10000);
          sinon.stub(steemHelper, 'getVoteValue').returns(Promise.resolve({ weight: percent, voteValue: vote }));
          await expirationHelper.expireMatchBotRecount(reqData);
          result = await BotUpvote.findOne({ status: 'upvoted', author: user, permlink: paymentData.reviewPermlink });
        });
        it('should create upvote record with positive voteWeight', async () => {
          expect(result).to.be.exist;
        });
        it('should create upvote record with correct reward', async () => {
          // default hive currency is 0.5, therefore, we multiply the result by 4
          // (by 2 due to the fact that 50% of the vote will go to the matchbot
          // and by 2 to convert the course to HIVE)
          expect(result.reward).to.be.eq(campaign.reward * 4);
        });
        it('should create upvote with correct vote', async () => {
          expect(result.currentVote).to.be.eq(vote);
        });
        it('should create upvote with correct votePercent', async () => {
          expect(result.votePercent).to.be.eq(percent);
        });
      });
      describe('with downvote', async () => {
        let result, percent;
        beforeEach(async () => {
          percent = _.random(-1000, -10000);
          sinon.stub(steemHelper, 'getVoteValue').returns(Promise.resolve({ weight: percent, voteValue: -1 }));
          await expirationHelper.expireMatchBotRecount(reqData);
          result = await BotUpvote.findOne({ status: 'upvoted', author: user, permlink: paymentData.reviewPermlink });
        });
        it('should not create record with downvote', async () => {
          expect(result).to.be.null;
        });
      });
    });
    describe('with pending botUpvote', async () => {
      let pendingUpvote;
      beforeEach(async () => {
        pendingUpvote = await BotUpvoteFactory.Create({
          bot_name: reqData.voter,
          author: user,
          sponsor: campaign.guideName,
          amountToVote: (campaign.reward / users[0].hiveCurrency) * 2,
          permlink: reqData.permlink,
          reward: campaign.reward * 2,
          reservationPermlink: paymentData.reservation_permlink,
          requiredObject,
        });
      });
      afterEach(async () => {
        sinon.restore();
      });
      describe('with vote', async () => {
        let result, vote, percent;
        beforeEach(async () => {
          percent = _.random(1000, 10000);
          vote = _.random(1, 10);
          sinon.stub(steemHelper, 'getVoteValue').returns(Promise.resolve({ weight: percent, voteValue: vote }));
          await expirationHelper.expireMatchBotRecount(reqData);
          result = await BotUpvote.findOne({ status: 'upvoted', author: user, permlink: paymentData.reviewPermlink });
        });
        it('should find current vote', async () => {
          expect(pendingUpvote._id).to.be.deep.eq(result._id);
        });
        it('should update status of upvote to updated', async () => {
          expect(result.status).to.be.eq('upvoted');
        });
        it('should set correct cutentVote', async () => {
          expect(result.currentVote).to.be.eq(vote);
        });
        it('should set correct votePercent', async () => {
          expect(result.votePercent).to.be.eq(percent);
        });
      });
      describe('on downvote', async () => {
        let result, vote, percent;
        beforeEach(async () => {
          percent = _.random(-1000, -10000);
          vote = _.random(-1);
          sinon.stub(steemHelper, 'getVoteValue').returns(Promise.resolve({ weight: percent, voteValue: vote }));
          await expirationHelper.expireMatchBotRecount(reqData);
          result = await BotUpvote.findOne({ status: 'upvoted', author: user, permlink: paymentData.reviewPermlink });
        });
        it('should delete botUpvote data', async () => {
          expect(result).to.be.null;
        });
      });
    });
    describe('with upvoted not executed botUpvote', async () => {
      let upvotedUpvote;
      beforeEach(async () => {
        upvotedUpvote = await BotUpvoteFactory.Create({
          currentVote: 1,
          totalVotesWeight: 1,
          votePercent: 1000,
          status: 'upvoted',
          bot_name: reqData.voter,
          author: user,
          sponsor: campaign.guideName,
          permlink: reqData.permlink,
          reward: campaign.reward * 2,
          reservationPermlink: paymentData.reservation_permlink,
          requiredObject,
        });
      });
      afterEach(async () => {
        sinon.restore();
      });
      describe('with vote', async () => {
        let vote, result, percent;
        beforeEach(async () => {
          vote = _.random(2, 10);
          percent = _.random(2000, 10000);
          sinon.stub(steemHelper, 'getVoteValue').returns(Promise.resolve({ weight: percent, voteValue: vote }));
          await expirationHelper.expireMatchBotRecount(reqData);
          result = await BotUpvote.findOne({ status: 'upvoted', author: user, permlink: paymentData.reviewPermlink });
        });
        it('should check that old upvote amount not eq with new record', async () => {
          expect(result.currentVote).to.be.not.eq(upvotedUpvote.currentVote);
        });
        it('should update botUpvoteRecord with new currentVote', async () => {
          expect(result.currentVote).to.be.eq(vote);
        });
        it('should update botUpvoteRecord with new votePercent', async () => {
          expect(result.votePercent).to.be.eq(percent);
        });
        it('should update botUpvoteRecord with new totalVoteAmount', async () => {
          expect(result.totalVotesWeight).to.be.eq(vote);
        });
      });
      describe('with downVote', async () => {
        let result, vote, percent;
        beforeEach(async () => {
          percent = _.random(-2000, -10000);
          vote = -1;
          sinon.stub(steemHelper, 'getVoteValue').returns(Promise.resolve({ weight: percent, voteValue: vote }));
          await expirationHelper.expireMatchBotRecount(reqData);
          result = await BotUpvote.findOne({ status: 'upvoted', author: user, permlink: paymentData.reviewPermlink });
        });
        it('should delete botUpvote data', async () => {
          expect(result).to.be.null;
        });
      });
      describe('with many botUpvotes', async () => {
        let secondUpvote;
        beforeEach(async () => {
          await BotUpvote.updateOne({ _id: upvotedUpvote._id }, { $inc: { totalVotesWeight: 1 } });
          secondUpvote = await BotUpvoteFactory.Create({
            currentVote: 1,
            totalVotesWeight: 2,
            votePercent: 1000,
            status: 'upvoted',
            bot_name: faker.name.firstName(),
            author: user,
            sponsor: campaign.guideName,
            permlink: reqData.permlink,
            reward: campaign.reward * 2,
            reservationPermlink: paymentData.reservation_permlink,
            requiredObject,
          });
        });
        afterEach(async () => {
          sinon.restore();
        });
        describe('with vote', async () => {
          let firstResult, secondResult, secondVote, secondPercent;
          beforeEach(async () => {
            secondVote = _.random(2, 10);
            secondPercent = _.random(3000, 10000);
            sinon.stub(steemHelper, 'getVoteValue').returns(Promise.resolve({ weight: secondPercent, voteValue: secondVote }));
            await expirationHelper.expireMatchBotRecount(reqData);
            secondResult = await BotUpvote.findOne({
              status: 'upvoted', author: user, permlink: paymentData.reviewPermlink, botName: secondUpvote.botName,
            });
            firstResult = await BotUpvote.findOne({
              status: 'upvoted', author: user, permlink: paymentData.reviewPermlink, botName: reqData.voter,
            });
          });
          it('should change totalVoteWeight at all records', async () => {
            expect(firstResult.totalVotesWeight).to.be.eq(secondResult.totalVotesWeight).to.be.eq(upvotedUpvote.currentVote + secondVote);
          });
        });
        describe('with downVote', async () => {
          let firstResult, secondResult;
          beforeEach(async () => {
            sinon.stub(steemHelper, 'getVoteValue').returns(Promise.resolve({ weight: -1000, voteValue: -1 }));
            await expirationHelper.expireMatchBotRecount(reqData);
            secondResult = await BotUpvote.findOne({
              status: 'upvoted', author: user, permlink: paymentData.reviewPermlink, botName: secondUpvote.botName,
            });
            firstResult = await BotUpvote.findOne({
              status: 'upvoted', author: user, permlink: paymentData.reviewPermlink, botName: reqData.voter,
            });
          });
          it('should delete first result', async () => {
            expect(firstResult).to.be.null;
          });
          it('should change totalVoteWeight at second vote', async () => {
            expect(secondResult.totalVotesWeight).to.be.eq(secondUpvote.currentVote);
          });
        });
      });
    });

    describe('with upvoted executed botUpvote', async () => {
      let executedUpvote, compensation;
      beforeEach(async () => {
        executedUpvote = await BotUpvoteFactory.Create({
          executed: true,
          currentVote: 1,
          totalVotesWeight: 1,
          votePercent: 1000,
          status: 'upvoted',
          bot_name: reqData.voter,
          author: user,
          sponsor: campaign.guideName,
          permlink: reqData.permlink,
          reward: campaign.reward * 2,
          reservationPermlink: paymentData.reservation_permlink,
          requiredObject,
        });
        await PaymentHistory.updateOne({ _id: reviewPayment._id }, { 'details.votesAmount': (executedUpvote.currentVote * 0.9) / 2, $inc: { amount: (-executedUpvote.currentVote * 0.9) / 2 } });
        await PaymentHistory.updateOne({ _id: benefPayment._id }, { 'details.votesAmount': (executedUpvote.currentVote * 0.1) / 2, $inc: { amount: (-executedUpvote.currentVote * 0.1) / 2 } });
        compensation = await PaymentHistoryFactory.Create(Object.assign(paymentData, { type: 'compensation_fee', amount: executedUpvote.currentVote / 2 }));
        await Campaign.updateOne(
          { _id: campaign._id }, { compensationAccount: compensation.userName },
        );
      });
      afterEach(async () => {
        sinon.restore();
      });
      describe('with vote', async () => {
        let vote, result, percent, reviewHistory, benefHistory, compensationHistory;
        beforeEach(async () => {
          percent = _.random(2000, 10000);
          vote = _.random(2, 10);
          sinon.stub(steemHelper, 'getVoteValue').returns(Promise.resolve({ weight: percent, voteValue: vote }));
          await expirationHelper.expireMatchBotRecount(reqData);
          result = await BotUpvote.findOne({ status: 'upvoted', author: user, permlink: paymentData.reviewPermlink });
          reviewHistory = await PaymentHistory.findOne({ _id: reviewPayment._id });
          benefHistory = await PaymentHistory.findOne({ _id: benefPayment._id });
          compensationHistory = await PaymentHistory.findOne({ _id: compensation._id });
        });
        it('should update botUpvote record', async () => {
          expect(result.currentVote).to.be.eq(vote);
        });
        it('should update reviewHistory', async () => {
          expect(_.round(reviewHistory.amount, 3)).to.be.eq(_.round(((campaign.reward - vote / 2) * 0.9), 3));
        });
        it('should update reviewHistory votesAmount', async () => {
          expect(_.round(reviewHistory.details.votesAmount, 3)).to.be.eq((vote * 0.9) / 2);
        });
        it('should update beneficiare history', async () => {
          expect(_.round(benefHistory.amount, 3)).to.be.eq(_.round((campaign.reward - vote / 2) * 0.1, 3));
        });
        it('should update beneficiare history votesAmount', async () => {
          expect(_.round(benefHistory.details.votesAmount, 3)).to.be.eq(_.round((vote * 0.1) / 2, 3));
        });
        it('should update compensation fee history', async () => {
          expect(compensationHistory.amount).to.be.eq(vote / 2);
        });
      });
      describe('with downVote', async () => {
        let result, reviewHistory, benefHistory, compensationHistory;
        beforeEach(async () => {
          sinon.stub(steemHelper, 'getVoteValue').returns(Promise.resolve({ weight: -1000, voteValue: -1 }));
          await expirationHelper.expireMatchBotRecount(reqData);
          result = await BotUpvote.findOne({ status: 'upvoted', author: user, permlink: paymentData.reviewPermlink });
          reviewHistory = await PaymentHistory.findOne({ _id: reviewPayment._id });
          benefHistory = await PaymentHistory.findOne({ _id: benefPayment._id });
          compensationHistory = await PaymentHistory.findOne({ _id: compensation._id });
        });
        it('should delete compensation payment', async () => {
          expect(compensationHistory).to.be.eq(null);
        });
        it('should delete upvote record', async () => {
          expect(result).to.be.eq(null);
        });
        it('should remove votesAmount from review payment history', async () => {
          expect(reviewHistory.details.votesAmount).to.be.eq(0);
        });
        it('should remove votesAmount from beneficiary payment history', async () => {
          expect(benefHistory.details.votesAmount).to.be.eq(0);
        });
        it('should update amount at review history', async () => {
          expect(reviewHistory.amount).to.be.eq(_.round(campaign.reward * 0.9, 3));
        });
        it('should update amount at beneficiary history', async () => {
          expect(benefHistory.amount).to.be.eq(campaign.reward * 0.1);
        });
      });
    });
  });

  describe('On recalculateDebt', async () => {
    let author, permlink, reward, reviewPmnt, benenifiaryFee, compensationFee, transfer, bot;
    beforeEach(async () => {
      await dropDatabase();
      const _id = new ObjectID();
      reward = _.random(5, 10);
      const reservation_permlink = faker.random.string();
      author = faker.name.firstName();
      bot = faker.name.firstName();
      permlink = faker.random.string();
      const campaign = await CampaignFactory.Create({
        match_bots: [bot],
        payments: [{
          reservationId: _id,
          status: 'active',
          userName: author,
          rootAuthor: author,
          postPermlink: permlink,
          postTitle: faker.random.string(),
          objectPermlink: faker.random.string(),
        }],
        users: [{
          _id,
          status: 'completed',
          name: author,
          permlink: reservation_permlink,
          hiveCurrency: 1,
          object_permlink: faker.random.string(),
          completedAt: new Date(),
        }],
      });
      reviewPmnt = await PaymentHistoryFactory.Create({
        amount: _.round((reward * 0.97) - 0.97, 3),
        type: 'review',
        userName: author,
        payed: true,
        sponsor: campaign.guideName,
        beneficiaries: [{ account: 'waivio', weight: 300 }],
        permlink: reservation_permlink,
        votesAmount: 0.97,
      });
      benenifiaryFee = await PaymentHistoryFactory.Create({
        type: 'beneficiary_fee',
        amount: _.round((reward * 0.03) - 0.03, 3),
        userName: 'waivio',
        payed: true,
        sponsor: campaign.guideName,
        beneficiaries: [{ account: 'waivio', weight: 300 }],
        permlink: reservation_permlink,
        votesAmount: 0.03,
      });
      compensationFee = await PaymentHistoryFactory.Create({
        type: 'compensation_fee',
        amount: 1,
        userName: faker.name.firstName(),
        sponsor: campaign.guideName,
        beneficiaries: [{ account: 'waivio', weight: 300 }],
        permlink: reservation_permlink,
      });
      transfer = await PaymentHistoryFactory.Create({
        type: 'transfer',
        amount: 15,
        userName: author,
        sponsor: campaign.guideName,
        payed: false,
        remaining: 10,
      });
    });
    afterEach(async () => {
      sinon.restore();
    });
    describe('On removeVoteDebt', async () => {
      beforeEach(async () => {
        sinon.stub(steemHelper, 'getPostInfo').returns(Promise.resolve({
          author, json_metadata: '', total_payout_value: '0.000 HBD', curator_payout_value: '0.000 HBD',
        }));
      });
      describe('without payout', async () => {
        it('should not change status (payed) of review payment if transfer && remaining > votesAmount', async () => {
          await expirationHelper.recalculateDebt(author, permlink);
          const result = await PaymentHistory.findOne({ _id: reviewPmnt._id });
          expect(result.payed).to.be.true;
        });
        it('should remove votes amount from review payment', async () => {
          await expirationHelper.recalculateDebt(author, permlink);
          const result = await PaymentHistory.findOne({ _id: reviewPmnt._id });
          expect(result.details.votesAmount).to.be.eq(0);
        });
        it('should add debt from votesAmount to amount at review payment', async () => {
          await expirationHelper.recalculateDebt(author, permlink);
          const result = await PaymentHistory.findOne({ _id: reviewPmnt._id });
          expect(_.round(result.amount, 3))
            .to.be.eq(_.round(reviewPmnt.amount + reviewPmnt.details.votesAmount, 3));
        });
        it('should change remaining at transfer payment', async () => {
          await expirationHelper.recalculateDebt(author, permlink);
          const result = await PaymentHistory.findOne({ _id: transfer._id });
          expect(_.round(result.details.remaining, 3))
            .to.be.eq(_.round(transfer.details.remaining - reviewPmnt.details.votesAmount, 3));
        });
        it('should change status (payed) at beneficiary debt if it was payed and no transfer remaining', async () => {
          await expirationHelper.recalculateDebt(author, permlink);
          const result = await PaymentHistory.findOne({ _id: benenifiaryFee._id });
          expect(result.payed).to.be.not.eq(benenifiaryFee.payed);
        });
        it('should remove compensation fee if it not payed', async () => {
          await expirationHelper.recalculateDebt(author, permlink);
          const result = await PaymentHistory.findOne({ _id: compensationFee._id });
          expect(result).to.be.null;
        });
        it('should change status to not payed if transfer remaining < votesAmount', async () => {
          await PaymentHistory.updateOne({ _id: transfer._id }, { 'details.remaining': 0.1 });
          await expirationHelper.recalculateDebt(author, permlink);
          const result = await PaymentHistory.findOne({ _id: reviewPmnt._id });
          expect(result.payed).to.be.false;
        });
        it('should not change remaining if transfer remaining < votesAmount', async () => {
          await PaymentHistory.updateOne({ _id: transfer._id }, { 'details.remaining': 0.1 });
          await expirationHelper.recalculateDebt(author, permlink);
          const result = await PaymentHistory.findOne({ _id: transfer._id });
          expect(result.details.remaining).to.be.eq(0.1 + reviewPmnt.amount);
        });
        it('should change status of transfer if remaining eq votesAmount', async () => {
          await PaymentHistory.updateOne({ _id: transfer._id }, { 'details.remaining': 0.97 });
          await expirationHelper.recalculateDebt(author, permlink);
          const result = await PaymentHistory.findOne({ _id: transfer._id });
          expect(result.payed).to.be.true;
        });
        it('should recount transfer remaining if compensation fee is payed (not payed transfer)', async () => {
          await PaymentHistory.updateOne({ _id: compensationFee._id }, { payed: true });
          const payment = await PaymentHistoryFactory.Create({ userName: compensationFee.userName, sponsor: compensationFee.sponsor, type: 'transfer' });
          await expirationHelper.recalculateDebt(author, permlink);
          const result = await PaymentHistory.findOne({ _id: payment._id });
          expect(result.details.remaining).to.be.eq(compensationFee.amount);
        });
        it('should recount transfer remaining if compensation fee is payed (payed transfer)', async () => {
          await PaymentHistory.updateOne({ _id: compensationFee._id }, { payed: true });
          const payment = await PaymentHistoryFactory.Create({
            userName: compensationFee.userName, sponsor: compensationFee.sponsor, type: 'transfer', payed: true,
          });
          await expirationHelper.recalculateDebt(author, permlink);
          const result = await PaymentHistory.findOne({ _id: payment._id });
          expect(result.details.remaining).to.be.eq(compensationFee.amount);
        });
        it('should change status (payed) at transfer after recount', async () => {
          await PaymentHistory.updateOne({ _id: compensationFee._id }, { payed: true });
          const payment = await PaymentHistoryFactory.Create({
            userName: compensationFee.userName, sponsor: compensationFee.sponsor, type: 'transfer', payed: true,
          });
          await expirationHelper.recalculateDebt(author, permlink);
          const result = await PaymentHistory.findOne({ _id: payment._id });
          expect(result.payed).to.be.false;
        });
      });
    });
    describe('On recountVoteDebt', async () => {
      const newVoteValue = 0.35;
      beforeEach(async () => {
        sinon.stub(steemHelper, 'getPostInfo').returns(Promise.resolve({
          author,
          json_metadata: '',
          total_payout_value: '0.330 HBD',
          curator_payout_value: '0.370 HBD',
          active_votes: [{ rshares: 1000, voter: bot }, { rshares: -500, voter: faker.random.string() }],
        }));
        sinon.stub(steemHelper, 'getCurrentPriceInfo').returns(Promise.resolve({ currentPrice: 1 }));
      });
      it('should update compensation fee with correct amount', async () => {
        await expirationHelper.recalculateDebt(author, permlink);
        const result = await PaymentHistory.findOne({ _id: compensationFee._id });
        expect(result.amount).to.be.eq(newVoteValue);
      });
      it('should recount transfer remaining', async () => {
        await expirationHelper.recalculateDebt(author, permlink);
        const result = await PaymentHistory.findOne({ _id: transfer._id });
        expect(result.details.remaining)
          .to.be.eq(transfer.details.remaining - (1 - newVoteValue) * 0.97);
      });
      it('should recount review votesAmount', async () => {
        await expirationHelper.recalculateDebt(author, permlink);
        const result = await PaymentHistory.findOne({ _id: reviewPmnt._id });
        expect(result.details.votesAmount)
          .to.be.eq(_.round((1 - (1 - newVoteValue)) * 0.97, 4));
      });
      it('should recount review amount', async () => {
        await expirationHelper.recalculateDebt(author, permlink);
        const result = await PaymentHistory.findOne({ _id: reviewPmnt._id });
        expect(_.round(result.amount, 2))
          .to.be.eq(_.round(reviewPmnt.amount + (1 - newVoteValue) * 0.97, 2));
      });
      it('should change payed status if transfer remaining < count difference', async () => {
        await PaymentHistory.updateOne({ _id: transfer._id }, { 'details.remaining': 0.01 });
        await expirationHelper.recalculateDebt(author, permlink);
        const result = await PaymentHistory.findOne({ _id: reviewPmnt._id });
        expect(result.payed).to.be.false;
      });
      it('should add to transfer remaining payed part if remaining < count difference', async () => {
        const newRemaining = 0.01;
        await PaymentHistory.updateOne({ _id: transfer._id }, { 'details.remaining': newRemaining });
        await expirationHelper.recalculateDebt(author, permlink);
        const result = await PaymentHistory.findOne({ _id: transfer._id });
        expect(result.details.remaining).to.be.eq(newRemaining + reviewPmnt.amount);
      });
    });
  });
});
