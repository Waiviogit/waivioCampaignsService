const {
  chai, chaiHttp, app, dropDatabase, sinon, axios, hiveOperations,
} = require('test/testHelper');
const { PaymentHistoryFactory } = require('test/factories');

const { expect } = chai;

chai.use(chaiHttp);
chai.should();


describe('Demo User Controller', async () => {
  describe('transfer', async () => {
    let userInfoStub, demoUser, to, amount, validateTokenStub;

    beforeEach(async () => {
      await dropDatabase();
      to = 'target_user';
      amount = 0.01;
      demoUser = 'demoUser';
      userInfoStub = { name: 'user1', balance: '10.911 STEEM' };
      validateTokenStub = { status: 200, data: { user: { name: 'demoUser' } } };
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

    it('should return success transfer', async () => {
      sinon.stub(hiveOperations, 'getAccountInfo').returns(Promise.resolve(userInfoStub));
      sinon.stub(hiveOperations, 'transfer').returns(Promise.resolve({ result: true }));
      sinon.stub(axios, 'post').returns(Promise.resolve(validateTokenStub));
      const res = await chai.request(app).post('/campaigns-api/guest/transfer').send({ data: { to, amount } });

      res.should.have.status(200);
    });

    it('should return error with dsteem transfer error', async () => {
      sinon.stub(hiveOperations, 'getAccountInfo').returns(Promise.resolve(userInfoStub));
      sinon.stub(hiveOperations, 'transfer').returns(Promise.resolve({ error: 'some_error' }));
      sinon.stub(axios, 'post').returns(Promise.resolve(validateTokenStub));
      const res = await chai.request(app).post('/campaigns-api/guest/transfer').send({ data: { to, amount } });

      res.should.have.status(422);
      expect(res.body.message).to.be.eql({ message: 'some_error' });
    });

    it('should return error with big amount', async () => {
      amount = 100;
      sinon.stub(hiveOperations, 'getAccountInfo').returns(Promise.resolve(userInfoStub));
      sinon.stub(hiveOperations, 'transfer').returns(Promise.resolve({ result: true }));
      sinon.stub(axios, 'post').returns(Promise.resolve(validateTokenStub));
      const res = await chai.request(app).post('/campaigns-api/guest/transfer').send({ data: { to, amount } });

      res.should.have.status(422);
      expect(res.body.message).to.be.eql({ message: 'The amount more than dept' });
    });

    it('should return error with no dept user', async () => {
      validateTokenStub.data.user.name = 'some_user';
      sinon.stub(hiveOperations, 'getAccountInfo').returns(Promise.resolve(userInfoStub));
      sinon.stub(hiveOperations, 'transfer').returns(Promise.resolve({ result: true }));
      sinon.stub(axios, 'post').returns(Promise.resolve(validateTokenStub));
      const res = await chai.request(app).post('/campaigns-api/guest/transfer').send({ data: { to, amount } });

      res.should.have.status(422);
      expect(res.body.message).to.be.eql({ message: 'The amount more than dept' });
    });

    it('should return error with invalid access-token', async () => {
      validateTokenStub.status = 401;
      sinon.stub(hiveOperations, 'getAccountInfo').returns(Promise.resolve(userInfoStub));
      sinon.stub(hiveOperations, 'transfer').returns(Promise.resolve({ result: true }));
      sinon.stub(axios, 'post').returns(Promise.resolve(validateTokenStub));
      const res = await chai.request(app).post('/campaigns-api/guest/transfer').send({ data: { to, amount } });

      res.should.have.status(401);
      expect(res.body.message).to.be.eq('No token provided.');
    });

    it('should return error without amount', async () => {
      sinon.stub(hiveOperations, 'getAccountInfo').returns(Promise.resolve(userInfoStub));
      sinon.stub(hiveOperations, 'transfer').returns(Promise.resolve({ result: true }));
      sinon.stub(axios, 'post').returns(Promise.resolve(validateTokenStub));
      const res = await chai.request(app).post('/campaigns-api/guest/transfer').send({ data: { to } });

      res.should.have.status(422);
    });

    it('should return error without receiver', async () => {
      sinon.stub(hiveOperations, 'getAccountInfo').returns(Promise.resolve(userInfoStub));
      sinon.stub(hiveOperations, 'transfer').returns(Promise.resolve({ result: true }));
      sinon.stub(axios, 'post').returns(Promise.resolve(validateTokenStub));
      const res = await chai.request(app).post('/campaigns-api/guest/transfer').send({ data: { amount } });

      res.should.have.status(422);
    });
  });
});
