const {
  expect, sinon, dropDatabase, ObjectID, _,
  PaymentHistory, faker, recalculateDebt, hiveOperations,
} = require('test/testHelper');
const {
  CampaignFactory, PaymentHistoryFactory,
} = require('test/factories');

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
      sinon.stub(hiveOperations, 'getPostInfo').returns(Promise.resolve({
        author, json_metadata: '', total_payout_value: '0.000 HBD', curator_payout_value: '0.000 HBD',
      }));
    });
    describe('without payout', async () => {
      it('should not change status (payed) of review payment if transfer && remaining > votesAmount', async () => {
        await recalculateDebt(author, permlink);
        const result = await PaymentHistory.findOne({ _id: reviewPmnt._id });
        expect(result.payed).to.be.true;
      });
      it('should remove votes amount from review payment', async () => {
        await recalculateDebt(author, permlink);
        const result = await PaymentHistory.findOne({ _id: reviewPmnt._id });
        expect(result.details.votesAmount).to.be.eq(0);
      });
      it('should add debt from votesAmount to amount at review payment', async () => {
        await recalculateDebt(author, permlink);
        const result = await PaymentHistory.findOne({ _id: reviewPmnt._id });
        expect(_.round(result.amount, 3))
          .to.be.eq(_.round(reviewPmnt.amount + reviewPmnt.details.votesAmount, 3));
      });
      it('should change remaining at transfer payment', async () => {
        await recalculateDebt(author, permlink);
        const result = await PaymentHistory.findOne({ _id: transfer._id });
        expect(_.round(result.details.remaining, 3))
          .to.be.eq(_.round(transfer.details.remaining - reviewPmnt.details.votesAmount, 3));
      });
      it('should change status (payed) at beneficiary debt if it was payed and no transfer remaining', async () => {
        await recalculateDebt(author, permlink);
        const result = await PaymentHistory.findOne({ _id: benenifiaryFee._id });
        expect(result.payed).to.be.not.eq(benenifiaryFee.payed);
      });
      it('should remove compensation fee if it not payed', async () => {
        await recalculateDebt(author, permlink);
        const result = await PaymentHistory.findOne({ _id: compensationFee._id });
        expect(result).to.be.null;
      });
      it('should change status to not payed if transfer remaining < votesAmount', async () => {
        await PaymentHistory.updateOne({ _id: transfer._id }, { 'details.remaining': 0.1 });
        await recalculateDebt(author, permlink);
        const result = await PaymentHistory.findOne({ _id: reviewPmnt._id });
        expect(result.payed).to.be.false;
      });
      it('should not change remaining if transfer remaining < votesAmount', async () => {
        await PaymentHistory.updateOne({ _id: transfer._id }, { 'details.remaining': 0.1 });
        await recalculateDebt(author, permlink);
        const result = await PaymentHistory.findOne({ _id: transfer._id });
        expect(result.details.remaining).to.be.eq(0.1 + reviewPmnt.amount);
      });
      it('should change status of transfer if remaining eq votesAmount', async () => {
        await PaymentHistory.updateOne({ _id: transfer._id }, { 'details.remaining': 0.97 });
        await recalculateDebt(author, permlink);
        const result = await PaymentHistory.findOne({ _id: transfer._id });
        expect(result.payed).to.be.true;
      });
      it('should recount transfer remaining if compensation fee is payed (not payed transfer)', async () => {
        await PaymentHistory.updateOne({ _id: compensationFee._id }, { payed: true });
        const payment = await PaymentHistoryFactory.Create({ userName: compensationFee.userName, sponsor: compensationFee.sponsor, type: 'transfer' });
        await recalculateDebt(author, permlink);
        const result = await PaymentHistory.findOne({ _id: payment._id });
        expect(result.details.remaining).to.be.eq(compensationFee.amount);
      });
      it('should recount transfer remaining if compensation fee is payed (payed transfer)', async () => {
        await PaymentHistory.updateOne({ _id: compensationFee._id }, { payed: true });
        const payment = await PaymentHistoryFactory.Create({
          userName: compensationFee.userName, sponsor: compensationFee.sponsor, type: 'transfer', payed: true,
        });
        await recalculateDebt(author, permlink);
        const result = await PaymentHistory.findOne({ _id: payment._id });
        expect(result.details.remaining).to.be.eq(compensationFee.amount);
      });
      it('should change status (payed) at transfer after recount', async () => {
        await PaymentHistory.updateOne({ _id: compensationFee._id }, { payed: true });
        const payment = await PaymentHistoryFactory.Create({
          userName: compensationFee.userName, sponsor: compensationFee.sponsor, type: 'transfer', payed: true,
        });
        await recalculateDebt(author, permlink);
        const result = await PaymentHistory.findOne({ _id: payment._id });
        expect(result.payed).to.be.false;
      });
    });
  });
  describe('On recountVoteDebt', async () => {
    const newVoteValue = 0.35;
    beforeEach(async () => {
      sinon.stub(hiveOperations, 'getPostInfo').returns(Promise.resolve({
        author,
        json_metadata: '',
        total_payout_value: '0.330 HBD',
        curator_payout_value: '0.370 HBD',
        percent_steem_dollars: 10000,
        active_votes: [{ rshares: 1000, voter: bot }, { rshares: -500, voter: faker.random.string() }],
      }));
      sinon.stub(hiveOperations, 'getCurrentPriceInfo').returns(Promise.resolve({ currentPrice: 1 }));
    });
    it('should update compensation fee with correct amount', async () => {
      await recalculateDebt(author, permlink);
      const result = await PaymentHistory.findOne({ _id: compensationFee._id });
      expect(result.amount).to.be.eq(newVoteValue);
    });
    it('should recount transfer remaining', async () => {
      await recalculateDebt(author, permlink);
      const result = await PaymentHistory.findOne({ _id: transfer._id });
      expect(result.details.remaining)
        .to.be.eq(transfer.details.remaining - (1 - newVoteValue) * 0.97);
    });
    it('should recount review votesAmount', async () => {
      await recalculateDebt(author, permlink);
      const result = await PaymentHistory.findOne({ _id: reviewPmnt._id });
      expect(result.details.votesAmount)
        .to.be.eq(_.round((1 - (1 - newVoteValue)) * 0.97, 4));
    });
    it('should recount review amount', async () => {
      await recalculateDebt(author, permlink);
      const result = await PaymentHistory.findOne({ _id: reviewPmnt._id });
      expect(_.round(result.amount, 2))
        .to.be.eq(_.round(reviewPmnt.amount + (1 - newVoteValue) * 0.97, 2));
    });
    it('should change payed status if transfer remaining < count difference', async () => {
      await PaymentHistory.updateOne({ _id: transfer._id }, { 'details.remaining': 0.01 });
      await recalculateDebt(author, permlink);
      const result = await PaymentHistory.findOne({ _id: reviewPmnt._id });
      expect(result.payed).to.be.false;
    });
    it('should add to transfer remaining payed part if remaining < count difference', async () => {
      const newRemaining = 0.01;
      await PaymentHistory.updateOne({ _id: transfer._id }, { 'details.remaining': newRemaining });
      await recalculateDebt(author, permlink);
      const result = await PaymentHistory.findOne({ _id: transfer._id });
      expect(result.details.remaining).to.be.eq(newRemaining + reviewPmnt.amount);
    });
  });
});
