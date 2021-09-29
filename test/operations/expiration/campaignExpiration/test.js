const { PAYMENT_DEBT } = require('constants/ttlData');
const {
  expect, sinon, dropDatabase, paymentsExpiration, hiveOperations,
  PaymentHistory, faker, _, Campaign, redisSetter,
} = require('test/testHelper');
const { CampaignFactory, PaymentHistoryFactory } = require('test/factories');
const { paymentHistoryModel } = require('models');

describe('On campaign expiration', async () => {
  describe('expire campaign payment data', async () => {
    let campaign, author, payment;
    beforeEach(async () => {
      author = faker.name.firstName();
      campaign = await CampaignFactory.Create({ status: 'active' });
      await CampaignFactory.Create({ guideName: campaign.guideName, status: 'active' });
      payment = await PaymentHistoryFactory.Create({
        type: 'review', sponsor: campaign.guideName, userName: author, payed: true,
      });
      await redisSetter.saveTTL(`expire:${PAYMENT_DEBT}|${payment._id.toString()}`, 1, campaign._id.toString());
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
      sinon.stub(hiveOperations, 'getPostInfo').returns(Promise.resolve(postStub));
      sinon.stub(hiveOperations, 'getPostAuthorReward').returns(Promise.resolve(2));
      author = 'author';
      permlink = 'permlink';
    });
    afterEach(() => {
      sinon.restore();
    });
    it('check payment type', async () => {
      await paymentsExpiration.expireDemoPost({ author, permlink });
      const paymentHistories = await PaymentHistory.find();
      expect(paymentHistories.length).to.be.eq(1);
      expect(paymentHistories[0].is_demo_account).to.be.eq(true);
      expect(paymentHistories[0].type).to.be.eq('demo_post');
    });
    it('check payment amount', async () => {
      await paymentsExpiration.expireDemoPost({ author, permlink });
      const paymentHistories = await PaymentHistory.find();
      expect(paymentHistories[0].amount).to.be.exist;
    });
    it('check payment user name', async () => {
      await paymentsExpiration.expireDemoPost({ author, permlink });
      const paymentHistories = await PaymentHistory.find();
      expect(paymentHistories[0].userName).to.be.eq('demoUser');
    });
    it('check payment sponsor', async () => {
      await paymentsExpiration.expireDemoPost({ author, permlink });
      const paymentHistories = await PaymentHistory.find();
      expect(paymentHistories[0].sponsor).to.be.eq('author');
    });
    it('check payment details', async () => {
      await paymentsExpiration.expireDemoPost({ author, permlink });
      const { result: paymentHistories } = await paymentHistoryModel.find();
      expect(paymentHistories[0].details.post_permlink).to.be.eq('permlink');
    });

    it('check payment record with null reward', async () => {
      sinon.restore();
      postStub.total_payout_value = '0.00 SBD';
      sinon.stub(hiveOperations, 'getPostInfo').returns(Promise.resolve(postStub));
      sinon.stub(hiveOperations, 'getPostAuthorReward').returns(Promise.resolve(0));
      await paymentsExpiration.expireDemoPost({ author, permlink });
      const paymentHistories = await PaymentHistory.find();
      expect(paymentHistories.length).to.be.eq(0);
    });
  });
});
