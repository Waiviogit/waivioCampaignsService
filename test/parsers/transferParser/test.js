const {
  PaymentHistory, transferParser, paymentsHelper, dropDatabase, expect, sinon, paymentHistoryModel,
} = require('test/testHelper');
const { UserFactory } = require('test/factories');
const { getMocksData } = require('./mocks');

describe('transfer Parser', async () => {
  let spy;

  beforeEach(async () => {
    await dropDatabase();
  });

  afterEach(() => {
    spy.restore();
  });

  describe('parseCampaignsTransfer', async () => {
    describe('user reward', async () => {
      let callback = null;

      beforeEach(() => {
        spy = sinon.spy(paymentsHelper, 'transfer');
      });

      afterEach(() => {
        sinon.restore();
      });

      it('should call transfer with valid data', async () => {
        const memo = JSON.stringify({ id: 'user_reward' });
        const { operation } = await getMocksData({
          from: 'user1',
          to: 'sponsor1',
          amount: '5 HIVE',
          memo,
        });

        await transferParser.parse(operation);
        await Promise.resolve(spy.returnValues[0])
          .then((data) => {
            callback = data.result;
          });
        expect(callback).to.be.true;
        expect(spy.calledOnce).to.be.true;
      });

      it('should not call transfer with invalid memo', async () => {
        const memo = '{ id: \'user_reward\' }}';
        const { operation } = await getMocksData({
          from: 'user1',
          to: 'sponsor1',
          amount: '5 HIVE',
          memo,
        });

        await transferParser.parse(operation);
        expect(spy.callCount).to.eq(0);
      });

      it('should not call transfer with only text memo', async () => {
        const memo = 'dlsf hdsf';
        const { operation } = await getMocksData({
          from: 'user1',
          to: 'sponsor1',
          amount: '5 HIVE',
          memo,
        });

        await transferParser.parse(operation);
        expect(spy.callCount).to.eq(0);
      });

      it('should not with steem amount', async () => {
        const memo = JSON.stringify({ id: 'user_reward' });
        const { operation } = await getMocksData({
          from: 'user1',
          to: 'sponsor1',
          amount: '5 HBD',
          memo,
        });

        await transferParser.parse(operation);
        expect(spy.callCount).to.eq(0);
      });
    });
    describe('guest reward', async () => {
      let callback = null;

      beforeEach(async () => {
        spy = sinon.spy(paymentHistoryModel, 'addPaymentHistory');
        await UserFactory.Create({ name: 'demoUser' });
      });

      afterEach(() => {
        sinon.restore();
      });

      it('should call transfer with valid data', async () => {
        const memo = JSON.stringify({ id: 'guest_reward', to: 'demoUser' });
        const { operation } = await getMocksData({
          from: 'sender',
          to: process.env.WALLET_ACC_NAME,
          amount: '5 HIVE',
          memo,
        });

        await transferParser.parse(operation);
        await Promise.resolve(spy.returnValues[0])
          .then((data) => {
            callback = data.result;
          });
        expect(callback).to.be.true;
        expect(spy.calledOnce).to.be.true;
      });

      it('check payment histories', async () => {
        const memo = JSON.stringify({ id: 'guest_reward', to: 'demoUser' });
        const { operation } = await getMocksData({
          from: 'sender',
          to: process.env.WALLET_ACC_NAME,
          amount: '0.25 HIVE',
          memo,
        });

        await transferParser.parse(operation);
        const records = await PaymentHistory.find();

        expect(records.length).to.be.eq(1);
        expect(records[0].userName).to.be.eq('demoUser');
        expect(records[0].is_demo_account).to.be.true;
        expect(records[0].amount).to.be.eq(0.25);
        expect(records[0].type).to.be.eq('demo_debt');
      });

      it('should not call transfer with invalid to account', async () => {
        const memo = JSON.stringify({ id: 'guest_reward', to: 'demoUser' });
        const { operation } = await getMocksData({
          from: 'sender',
          to: 'waiviobankaaaaa',
          amount: '5 HIVE',
          memo,
        });

        await transferParser.parse(operation);
        expect(spy.callCount).to.be.eq(0);
      });

      it('should call transfer without to in memo json', async () => {
        const memo = JSON.stringify({ id: 'guest_reward' });
        const { operation } = await getMocksData({
          from: 'sender',
          to: 'waiviobank',
          amount: '5 HIVE',
          memo,
        });

        await transferParser.parse(operation);
        expect(spy.callCount).to.eq(0);
      });

      it('should call transfer with invalid user in memo', async () => {
        const memo = JSON.stringify({ id: 'guest_reward', to: 'aaaa' });
        const { operation } = await getMocksData({
          from: 'sender',
          to: 'waiviobank',
          amount: '5 HIVE',
          memo,
        });

        await transferParser.parse(operation);
        expect(spy.callCount).to.eq(0);
      });
    });

    describe('guest user_to_guest_transfer', async () => {
      let callback = null;

      beforeEach(async () => {
        spy = sinon.spy(paymentHistoryModel, 'addPaymentHistory');
        await UserFactory.Create({ name: 'demoUser' });
      });

      afterEach(() => {
        sinon.restore();
      });

      it('should call transfer with valid data', async () => {
        const memo = JSON.stringify({ id: 'user_to_guest_transfer', to: 'demoUser' });
        const { operation } = await getMocksData({
          from: 'sender',
          to: process.env.WALLET_ACC_NAME,
          amount: '5 HIVE',
          memo,
        });

        await transferParser.parse(operation);
        await Promise.resolve(spy.returnValues[0])
          .then((data) => {
            callback = data.result;
          });
        expect(callback).to.be.true;
        expect(spy.calledOnce).to.be.true;
      });

      it('check payment histories', async () => {
        const memo = JSON.stringify({ id: 'user_to_guest_transfer', to: 'demoUser' });
        const { operation } = await getMocksData({
          from: 'sender',
          to: process.env.WALLET_ACC_NAME,
          amount: '5 HIVE',
          memo,
        });

        await transferParser.parse(operation);
        const records = await PaymentHistory.find();

        expect(records.length).to.be.eq(1);
        expect(records[0].userName).to.be.eq('demoUser');
        expect(records[0].is_demo_account).to.be.true;
        expect(records[0].amount).to.be.eq(5);
        expect(records[0].type).to.be.eq('user_to_guest_transfer');
      });

      it('should call transfer without to in memo json', async () => {
        const memo = JSON.stringify({ id: 'user_to_guest_transfer' });
        const { operation } = await getMocksData({
          from: 'sender',
          to: 'waiviobank',
          amount: '5 HIVE',
          memo,
        });

        await transferParser.parse(operation);
        expect(spy.callCount).to.eq(0);
      });

      it('should call transfer with invalid user in memo', async () => {
        const memo = JSON.stringify({ id: 'user_to_guest_transfer', to: 'aaaa' });
        const { operation } = await getMocksData({
          from: 'sender',
          to: 'waiviobank',
          amount: '5 HIVE',
          memo,
        });

        await transferParser.parse(operation);
        expect(spy.callCount).to.eq(0);
      });

      it('should not call transfer with invalid to account', async () => {
        const memo = JSON.stringify({ id: 'user_to_guest_transfer', to: 'demoUser' });
        const { operation } = await getMocksData({
          from: 'sender',
          to: process.env.WALLET_ACC_NAME,
          amount: '5 HIVE',
          memo,
        });

        await transferParser.parse(operation);
        await Promise.resolve(spy.returnValues[0])
          .then((data) => {
            callback = data.result;
          });
        expect(callback).to.be.true;
        expect(spy.calledOnce).to.be.true;
      });
    });
  });
});
