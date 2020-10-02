const {
  demoUsersHelper, expect, sinon, dropDatabase, steemHelper,
} = require('test/testHelper');
const { PaymentHistoryFactory } = require('test/factories');

describe('demoUserHelper', async () => {
  describe('transfer', async () => {
    let userInfoStub, demoUser, to, amount;
    beforeEach(async () => {
      await dropDatabase();
      to = 'target_user';
      amount = 0.01;
      demoUser = 'demoUser';
      userInfoStub = { name: 'user1', balance: '10.911 STEEM' };
      await PaymentHistoryFactory.Create({
        userName: demoUser, type: 'demo_post', amount: 5, is_demo_account: true,
      });
      await PaymentHistoryFactory.Create({
        userName: demoUser, type: 'demo_post', amount: 5.45, is_demo_account: true,
      });
    });

    afterEach(() => {
      sinon.restore();
    });
    it('should be return success', async () => {
      sinon.stub(steemHelper, 'getAccountInfo').returns(Promise.resolve(userInfoStub));
      sinon.stub(steemHelper, 'transfer').returns(Promise.resolve({ result: true }));
      const { result } = await demoUsersHelper.transfer({ demoUser, data: { to, amount } });
      expect(result).to.be.true;
    });
    it('should be return success with amount eq dept', async () => {
      amount = 10.45;
      sinon.stub(steemHelper, 'getAccountInfo').returns(Promise.resolve(userInfoStub));
      sinon.stub(steemHelper, 'transfer').returns(Promise.resolve({ result: true }));
      const { result } = await demoUsersHelper.transfer({ demoUser, data: { to, amount } });
      expect(result).to.be.true;
    });
    it('should be return error if amount more than real dept', async () => {
      amount = 10.5;
      sinon.stub(steemHelper, 'getAccountInfo').returns(Promise.resolve(userInfoStub));
      sinon.stub(steemHelper, 'transfer').returns(Promise.resolve({ result: true }));
      const { error } = await demoUsersHelper.transfer({ demoUser, data: { to, amount } });
      expect(error).to.be.exist;
    });
    it('should be return error if amount more than bot balance', async () => {
      await PaymentHistoryFactory.Create({
        userName: demoUser, type: 'demo_post', amount: 5, is_demo_account: true,
      });
      amount = 11.5;
      sinon.stub(steemHelper, 'getAccountInfo').returns(Promise.resolve(userInfoStub));
      sinon.stub(steemHelper, 'transfer').returns(Promise.resolve({ result: true }));
      const { error } = await demoUsersHelper.transfer({ demoUser, data: { to, amount } });
      expect(error).to.be.exist;
    });
    it('should be return error with transfer error', async () => {
      sinon.stub(steemHelper, 'getAccountInfo').returns(Promise.resolve(userInfoStub));
      sinon.stub(steemHelper, 'transfer').returns(Promise.resolve({ error: { message: 'some_error' } }));
      const { error } = await demoUsersHelper.transfer({ demoUser, data: { to, amount } });
      expect(error).to.be.eql({ message: 'some_error' });
    });
    it('should be return error with without dept records', async () => {
      sinon.stub(steemHelper, 'getAccountInfo').returns(Promise.resolve(userInfoStub));
      sinon.stub(steemHelper, 'transfer').returns(Promise.resolve({ result: true }));
      const { error } = await demoUsersHelper.transfer({ demoUser: 'eugenezh', data: { to: 'qwertyuiop[45678', amount } });
      expect(error).to.be.exist;
    });
  });
});
