const {
  expect, sinon, dropDatabase, ObjectID, expireMatchBotRecount,
  PaymentHistory, faker, BotUpvote, _, Campaign, hiveOperations,
} = require('test/testHelper');
const {
  CampaignFactory, PaymentHistoryFactory, BotUpvoteFactory,
} = require('test/factories');

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
        sinon.stub(hiveOperations, 'getVoteValue').returns(Promise.resolve({ weight: percent, voteValue: vote }));
        sinon.stub(hiveOperations, 'getPostInfo').returns(Promise.resolve({}));
        await expireMatchBotRecount(reqData);
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
        sinon.stub(hiveOperations, 'getVoteValue').returns(Promise.resolve({ weight: percent, voteValue: -1 }));
        await expireMatchBotRecount(reqData);
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
        sinon.stub(hiveOperations, 'getVoteValue').returns(Promise.resolve({ weight: percent, voteValue: vote }));
        await expireMatchBotRecount(reqData);
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
        sinon.stub(hiveOperations, 'getVoteValue').returns(Promise.resolve({ weight: percent, voteValue: vote }));
        await expireMatchBotRecount(reqData);
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
        sinon.stub(hiveOperations, 'getVoteValue').returns(Promise.resolve({ weight: percent, voteValue: vote }));
        await expireMatchBotRecount(reqData);
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
        sinon.stub(hiveOperations, 'getVoteValue').returns(Promise.resolve({ weight: percent, voteValue: vote }));
        await expireMatchBotRecount(reqData);
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
          sinon.stub(hiveOperations, 'getVoteValue').returns(Promise.resolve({ weight: secondPercent, voteValue: secondVote }));
          await expireMatchBotRecount(reqData);
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
          sinon.stub(hiveOperations, 'getVoteValue').returns(Promise.resolve({ weight: -1000, voteValue: -1 }));
          await expireMatchBotRecount(reqData);
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
        sinon.stub(hiveOperations, 'getVoteValue').returns(Promise.resolve({ weight: percent, voteValue: vote }));
        await expireMatchBotRecount(reqData);
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
        sinon.stub(hiveOperations, 'getVoteValue').returns(Promise.resolve({ weight: -1000, voteValue: -1 }));
        await expireMatchBotRecount(reqData);
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
