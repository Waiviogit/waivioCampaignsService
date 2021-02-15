const {
  expect, sinon, dropDatabase, paymentsExpiration,
  PaymentHistory, faker, hiveOperations,
} = require('test/testHelper');
const { UserFactory } = require('test/factories');

describe('On paymentsExpiration', async () => {
  describe('Expire demoPost with realHive account', async () => {
    let realHive, postStub;
    beforeEach(async () => {
      realHive = faker.name.firstName();
      await dropDatabase();
      const user = await UserFactory.Create(
        { userMetadata: { settings: { hiveBeneficiaryAccount: realHive } } },
      );
      postStub = { total_payout_value: '3.34 SBD', curator_payout_value: '3.34 SBD', json_metadata: JSON.stringify({ comment: { userId: user.name } }) };
      sinon.stub(hiveOperations, 'getPostInfo').returns(Promise.resolve(postStub));
      sinon.stub(hiveOperations, 'getPostAuthorReward').returns(Promise.resolve(2));
    });
    afterEach(async () => {
      sinon.restore();
    });
    it('should not create debt with realHive account', async () => {
      await paymentsExpiration.expireDemoPost(
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
      sinon.stub(hiveOperations, 'getPostInfo').returns(Promise.resolve(postStub));
      sinon.stub(hiveOperations, 'getPostAuthorReward').returns(Promise.resolve(2));
      await paymentsExpiration.expireDemoPost(
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
      sinon.stub(hiveOperations, 'getPostInfo').returns(Promise.resolve(postStub));
      sinon.stub(hiveOperations, 'getPostAuthorReward').returns(Promise.resolve(2));
      await paymentsExpiration.expireDemoPost(
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
});
