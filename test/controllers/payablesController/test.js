const {
  chai, chaiHttp, app, dropDatabase, moment, _, sinon, faker, expect, PaymentHistory,
} = require('test/testHelper');
const { PaymentHistoryFactory, WobjectFactory } = require('test/factories');

chai.use(chaiHttp);
chai.should();

describe('Payables', async () => {
  describe('POST payables', async () => {
    describe('without fee and app commission and beneficiaries', async () => {
      before(async () => {
        await dropDatabase();
        const object = await WobjectFactory.Create();
        await PaymentHistoryFactory.Create({
          main_object: object.author_permlink, review_object: object.author_permlink, userName: 'user1', sponsor: 'sponsor1', type: 'review', amount: 2, createdAt: moment().subtract(10, 'days'),
        });
        await PaymentHistoryFactory.Create({
          main_object: object.author_permlink, review_object: object.author_permlink, userName: 'user2', sponsor: 'sponsor1', type: 'review', amount: 4, createdAt: moment().subtract(9, 'days'),
        });
        await PaymentHistoryFactory.Create({
          userName: 'user1', sponsor: 'sponsor1', type: 'transfer', amount: 2, createdAt: moment().subtract(8, 'days'),
        });
        await PaymentHistoryFactory.Create({
          main_object: object.author_permlink, review_object: object.author_permlink, userName: 'user2', sponsor: 'sponsor2', type: 'review', amount: 7.5, createdAt: moment().subtract(6, 'days'),
        });
        await PaymentHistoryFactory.Create({
          main_object: object.author_permlink, review_object: object.author_permlink, userName: 'user1', sponsor: 'sponsor1', type: 'review', amount: 2, createdAt: moment().subtract(6, 'days'),
        });
        await PaymentHistoryFactory.Create({
          userName: 'user2', sponsor: 'sponsor2', type: 'transfer', amount: 7, createdAt: moment().subtract(5, 'days'),
        });
        await PaymentHistoryFactory.Create({
          main_object: object.author_permlink, review_object: object.author_permlink, userName: 'user3', sponsor: 'sponsor1', type: 'review', amount: 70, createdAt: moment().subtract(3, 'days'),
        });
        await PaymentHistoryFactory.Create({
          main_object: object.author_permlink, review_object: object.author_permlink, userName: 'user3', sponsor: 'sponsor1', type: 'review', amount: 90, createdAt: moment().subtract(3, 'days'),
        });
        await PaymentHistoryFactory.Create({
          userName: 'user4', sponsor: 'sponsor1', type: 'transfer', amount: 10, createdAt: moment().subtract(2, 'days'),
        });
        await PaymentHistoryFactory.Create({
          userName: 'user4', sponsor: 'sponsor1', type: 'transfer', amount: 20, createdAt: moment().subtract(2, 'days'),
        });
      });
      describe('with wrapper receivables', async () => {
        it('should get receivables by user1', async () => {
          const res = await chai.request(app)
            .post('/campaigns-api/payments/payables')
            .send({ userName: 'user1' });
          res.should.have.status(200);
          res.body.histories.length.should.to.be.eq(1);
          res.body.payable.should.to.be.eq(2);
        });
        it('should get receivables by user2', async () => {
          const res = await chai.request(app)
            .post('/campaigns-api/payments/payables')
            .send({ userName: 'user2' });
          res.should.have.status(200);
          res.body.histories.length.should.to.be.eq(2);
          res.body.payable.should.to.be.eq(4.5);
        });
        it('should get receivables by user3', async () => {
          const res = await chai.request(app)
            .post('/campaigns-api/payments/payables')
            .send({ userName: 'user3' });
          res.should.have.status(200);
          res.body.histories.length.should.to.be.eq(1);
          res.body.payable.should.to.be.eq(160);
        });
        it('should get receivables by invalid user', async () => {
          const res = await chai.request(app)
            .post('/campaigns-api/payments/payables')
            .send({ userName: 'invalidUser' });
          res.should.have.status(200);
          res.body.histories.length.should.to.be.eq(0);
          res.body.payable.should.to.be.eq(0);
        });
        it('should get receivables by user without payments', async () => {
          const res = await chai.request(app)
            .post('/campaigns-api/payments/payables')
            .send({ userName: 'user5' });
          res.should.have.status(200);
          res.body.histories.length.should.to.be.eq(0);
          res.body.payable.should.to.be.eq(0);
        });
        it('should get receivables sponsor with skip', async () => {
          const res = await chai.request(app)
            .post('/campaigns-api/payments/payables')
            .send({ skip: 1, userName: 'user2' });
          res.should.have.status(200);
          res.body.histories.length.should.to.be.eq(1);
          res.body.payable.should.to.be.eq(4.5);
        });
        it('should get receivables sponsor with filter by payable', async () => {
          const res = await chai.request(app)
            .post('/campaigns-api/payments/payables')
            .send({ payable: 3, userName: 'user2' });
          res.should.have.status(200);
          res.body.histories.length.should.to.be.eq(1);
          res.body.payable.should.to.be.eq(4);
        });
        it('should get receivables sponsor with filter by date', async () => {
          const res = await chai.request(app)
            .post('/campaigns-api/payments/payables')
            .send({ days: 9, userName: 'user2' });
          res.should.have.status(200);
          res.body.histories.length.should.to.be.eq(1);
          res.body.payable.should.to.be.eq(4);
        });
      });
      describe('with wrapper payables', async () => {
        it('should get payables sponsor 1', async () => {
          const res = await chai.request(app)
            .post('/campaigns-api/payments/payables')
            .send({ sponsor: 'sponsor1' });
          res.should.have.status(200);
          res.body.histories.length.should.to.be.eq(4);
          res.body.payable.should.to.be.eq(136);
        });

        it('should get payables sponsor 2', async () => {
          const res = await chai.request(app)
            .post('/campaigns-api/payments/payables')
            .send({ sponsor: 'sponsor1' });
          res.should.have.status(200);
          res.body.histories.length.should.to.be.eq(4);
        });
        it('should get payables sponsor with skip', async () => {
          const res = await chai.request(app)
            .post('/campaigns-api/payments/payables')
            .send({ sponsor: 'sponsor1', skip: 1 });
          res.should.have.status(200);
          res.body.histories.length.should.to.be.eq(3);
          res.body.payable.should.to.be.eq(136);
        });
        it('should get payables sponsor with filter by payable', async () => {
          const res = await chai.request(app)
            .post('/campaigns-api/payments/payables')
            .send({ sponsor: 'sponsor1', payable: 3 });
          res.should.have.status(200);
          res.body.histories.length.should.to.be.eq(2);
          res.body.payable.should.to.be.eq(164);
        });
        it('should get payables sponsor with filter by date', async () => {
          const res = await chai.request(app)
            .post('/campaigns-api/payments/payables')
            .send({ sponsor: 'sponsor1', days: 3 });
          res.should.have.status(200);
          res.body.histories.length.should.to.be.eq(3);
          res.body.payable.should.to.be.eq(166);
        });
      });
      describe('without wrapper payables', async () => {
        it('should get payables sponsor 1 user 1', async () => {
          const res = await chai.request(app)
            .post('/campaigns-api/payments/payables')
            .send({ sponsor: 'sponsor1', userName: 'user1' });
          res.should.have.status(200);
          res.body.histories.length.should.to.be.eq(3);
          res.body.payable.should.to.be.eq(2);
        });
        it('should get payables sponsor 2 user 2', async () => {
          const res = await chai.request(app)
            .post('/campaigns-api/payments/payables')
            .send({ sponsor: 'sponsor2', userName: 'user2' });
          res.should.have.status(200);
          res.body.histories.length.should.to.be.eq(2);
          res.body.payable.should.to.be.eq(0.5);
        });
        it('should get payables with limit', async () => {
          const res = await chai.request(app)
            .post('/campaigns-api/payments/payables')
            .send({ sponsor: 'sponsor1', userName: 'user1', limit: 2 });
          res.should.have.status(200);
          res.body.histories.length.should.to.be.eq(2);
          res.body.payable.should.to.be.eq(2);
        });
        it('should get payables with skip', async () => {
          const res = await chai.request(app)
            .post('/campaigns-api/payments/payables')
            .send({ sponsor: 'sponsor1', userName: 'user1', skip: 2 });
          res.should.have.status(200);
          res.body.histories.length.should.to.be.eq(1);
          res.body.payable.should.to.be.eq(2);
        });
      });
    });
    describe('with app commission and index server commission', async () => {
      before(async () => {
        await dropDatabase();
        const object = await WobjectFactory.Create();
        const review1 = await PaymentHistoryFactory.Create({
          main_object: object.author_permlink, review_object: object.author_permlink, userName: 'user1', sponsor: 'sponsor1', type: 'review', amount: 10, createdAt: moment().subtract(10, 'days'),
        });
        await PaymentHistoryFactory.Create({
          main_object: object.author_permlink, review_object: object.author_permlink, permlink: review1.details.reservation_permlink, userName: 'waivio', sponsor: 'sponsor1', type: 'index_fee', amount: 0.05, createdAt: moment().subtract(10, 'days'),
        });
        await PaymentHistoryFactory.Create({
          main_object: object.author_permlink, review_object: object.author_permlink, permlink: review1.details.reservation_permlink, userName: 'app', sponsor: 'sponsor1', type: 'campaign_server_fee', amount: 0.025, createdAt: moment().subtract(10, 'days'),
        });
        await PaymentHistoryFactory.Create({
          main_object: object.author_permlink, review_object: object.author_permlink, permlink: review1.details.reservation_permlink, userName: 'app', sponsor: 'sponsor1', type: 'referral_server_fee', amount: 0.025, createdAt: moment().subtract(10, 'days'),
        });
        const review2 = await PaymentHistoryFactory.Create({
          main_object: object.author_permlink, review_object: object.author_permlink, userName: 'user1', sponsor: 'sponsor1', type: 'review', amount: 20, createdAt: moment().subtract(5, 'days'),
        });
        await PaymentHistoryFactory.Create({
          main_object: object.author_permlink, review_object: object.author_permlink, permlink: review2.details.reservation_permlink, userName: 'waivio', sponsor: 'sponsor1', type: 'index_fee', amount: 0.1, createdAt: moment().subtract(5, 'days'),
        });
        await PaymentHistoryFactory.Create({
          main_object: object.author_permlink, review_object: object.author_permlink, permlink: review2.details.reservation_permlink, userName: 'app', sponsor: 'sponsor1', type: 'campaign_server_fee', amount: 0.05, createdAt: moment().subtract(5, 'days'),
        });
        await PaymentHistoryFactory.Create({
          main_object: object.author_permlink, review_object: object.author_permlink, permlink: review2.details.reservation_permlink, userName: 'app', sponsor: 'sponsor1', type: 'referral_server_fee', amount: 0.05, createdAt: moment().subtract(5, 'days'),
        });
        const review3 = await PaymentHistoryFactory.Create({
          main_object: object.author_permlink, review_object: object.author_permlink, userName: 'user1', sponsor: 'sponsor2', type: 'review', amount: 20, createdAt: moment().subtract(4, 'days'),
        });
        await PaymentHistoryFactory.Create({
          main_object: object.author_permlink, review_object: object.author_permlink, permlink: review3.details.reservation_permlink, userName: 'waivio', sponsor: 'sponsor2', type: 'index_fee', amount: 0.1, createdAt: moment().subtract(4, 'days'),
        });
        await PaymentHistoryFactory.Create({
          main_object: object.author_permlink, review_object: object.author_permlink, permlink: review3.details.reservation_permlink, userName: 'app', sponsor: 'sponsor2', type: 'campaign_server_fee', amount: 0.05, createdAt: moment().subtract(4, 'days'),
        });
        await PaymentHistoryFactory.Create({
          main_object: object.author_permlink, review_object: object.author_permlink, permlink: review3.details.reservation_permlink, userName: 'app', sponsor: 'sponsor2', type: 'referral_server_fee', amount: 0.05, createdAt: moment().subtract(4, 'days'),
        });
      });
      it('should get receivables by user1 with wrapper', async () => {
        const res = await chai.request(app)
          .post('/campaigns-api/payments/payables')
          .send({ userName: 'user1' });
        res.should.have.status(200);
        res.body.histories.length.should.to.be.eq(2);
        res.body.payable.should.to.be.eq(50);
        res.body.histories[0].payable.should.to.be.eq(30);
        res.body.histories[1].payable.should.to.be.eq(20);
      });
      it('should get receivables by app with wrapper', async () => {
        const res = await chai.request(app)
          .post('/campaigns-api/payments/payables')
          .send({ userName: 'app' });
        res.should.have.status(200);
        res.body.histories.length.should.to.be.eq(2);
        res.body.payable.should.to.be.eq(0.25);
        _.round(res.body.histories[0].payable, 2).should.to.be.eq(0.15);
        _.round(res.body.histories[1].payable, 2).should.to.be.eq(0.1);
      });
      it('should get receivables by waivio with wrapper', async () => {
        const res = await chai.request(app)
          .post('/campaigns-api/payments/payables')
          .send({ userName: 'waivio' });
        res.should.have.status(200);
        res.body.histories.length.should.to.be.eq(2);
        res.body.payable.should.to.be.eq(0.25);
        _.round(res.body.histories[0].payable, 2).should.to.be.eq(0.15);
        _.round(res.body.histories[1].payable, 2).should.to.be.eq(0.1);
      });
      it('should get payables by sponsor1 with wrapper', async () => {
        const res = await chai.request(app)
          .post('/campaigns-api/payments/payables')
          .send({ sponsor: 'sponsor1' });
        res.should.have.status(200);
        res.body.histories.length.should.to.be.eq(3);
        res.body.payable.should.to.be.eq(30.3);
        _.round(res.body.histories[0].payable, 2).should.to.be.eq(30);
        _.round(res.body.histories[1].payable, 2).should.to.be.eq(0.15);
        _.round(res.body.histories[2].payable, 2).should.to.be.eq(0.15);
      });
      it('should get payables by sponsor2 with wrapper', async () => {
        const res = await chai.request(app)
          .post('/campaigns-api/payments/payables')
          .send({ sponsor: 'sponsor2' });
        res.should.have.status(200);
        res.body.histories.length.should.to.be.eq(3);
        res.body.payable.should.to.be.eq(20.201);
        _.round(res.body.histories[0].payable, 2).should.to.be.eq(20);
        _.round(res.body.histories[1].payable, 2).should.to.be.eq(0.1);
        _.round(res.body.histories[2].payable, 2).should.to.be.eq(0.1);
      });
      it('should get payables by sponsor1 and user1 without wrapper', async () => {
        const res = await chai.request(app)
          .post('/campaigns-api/payments/payables')
          .send({ sponsor: 'sponsor1', userName: 'user1' });
        res.should.have.status(200);
        res.body.histories.length.should.to.be.eq(2);
        res.body.payable.should.to.be.eq(30);
        [res.body.histories[0].amount, res.body.histories[0].balance].should.to.be.eql([20, 30]);
        [res.body.histories[1].amount, res.body.histories[1].balance].should.to.be.eql([10, 10]);
      });

      it('should get payables by sponsor1 and waivio without wrapper', async () => {
        const res = await chai.request(app)
          .post('/campaigns-api/payments/payables')
          .send({ sponsor: 'sponsor1', userName: 'waivio' });
        res.should.have.status(200);
        res.body.histories.length.should.to.be.eq(2);
        res.body.payable.should.to.be.eq(0.15);
        [_.round(res.body.histories[0].amount, 2),
          _.round(res.body.histories[0].balance, 2)].should.to.be.eql([0.1, 0.15]);
        [_.round(res.body.histories[1].amount, 2),
          _.round(res.body.histories[1].balance, 2)].should.to.be.eql([0.05, 0.05]);
      });

      it('should get payables by sponsor2 and app without wrapper', async () => {
        const res = await chai.request(app)
          .post('/campaigns-api/payments/payables')
          .send({ sponsor: 'sponsor2', userName: 'app' });
        res.should.have.status(200);
        res.body.histories.length.should.to.be.eq(2);
        res.body.payable.should.to.be.eq(0.1);
        [_.round(res.body.histories[0].amount, 2),
          _.round(res.body.histories[0].balance, 2)].should.to.be.eql([0.05, 0.1]);
      });
    });
    describe('with app commission and index server commission and beneficiaries', async () => {
      before(async () => {
        await dropDatabase();
        const object = await WobjectFactory.Create();
        const review1 = await PaymentHistoryFactory.Create({
          main_object: object.author_permlink, review_object: object.author_permlink, userName: 'user1', sponsor: 'sponsor1', type: 'review', amount: 9, createdAt: moment().subtract(10, 'days'),
        });
        await PaymentHistoryFactory.Create({
          main_object: object.author_permlink, review_object: object.author_permlink, permlink: review1.details.reservation_permlink, userName: 'beneficiar', sponsor: 'sponsor1', type: 'beneficiary_fee', amount: 1, createdAt: moment().subtract(10, 'days'),
        });
        await PaymentHistoryFactory.Create({
          main_object: object.author_permlink, review_object: object.author_permlink, permlink: review1.details.reservation_permlink, userName: 'waivio', sponsor: 'sponsor1', type: 'index_fee', amount: 0.05, createdAt: moment().subtract(10, 'days'),
        });
        await PaymentHistoryFactory.Create({
          main_object: object.author_permlink, review_object: object.author_permlink, permlink: review1.details.reservation_permlink, userName: 'app', sponsor: 'sponsor1', type: 'campaign_server_fee', amount: 0.025, createdAt: moment().subtract(10, 'days'),
        });
        await PaymentHistoryFactory.Create({
          main_object: object.author_permlink, review_object: object.author_permlink, permlink: review1.details.reservation_permlink, userName: 'app', sponsor: 'sponsor1', type: 'referral_server_fee', amount: 0.025, createdAt: moment().subtract(10, 'days'),
        });
        const review2 = await PaymentHistoryFactory.Create({
          main_object: object.author_permlink, review_object: object.author_permlink, userName: 'user1', sponsor: 'sponsor1', type: 'review', amount: 18, createdAt: moment().subtract(5, 'days'),
        });
        await PaymentHistoryFactory.Create({
          main_object: object.author_permlink, review_object: object.author_permlink, permlink: review2.details.reservation_permlink, userName: 'beneficiar', sponsor: 'sponsor1', type: 'beneficiary_fee', amount: 2, createdAt: moment().subtract(5, 'days'),
        });
        await PaymentHistoryFactory.Create({
          main_object: object.author_permlink, review_object: object.author_permlink, permlink: review2.details.reservation_permlink, userName: 'waivio', sponsor: 'sponsor1', type: 'index_fee', amount: 0.1, createdAt: moment().subtract(5, 'days'),
        });
        await PaymentHistoryFactory.Create({
          main_object: object.author_permlink, review_object: object.author_permlink, permlink: review2.details.reservation_permlink, userName: 'app', sponsor: 'sponsor1', type: 'campaign_server_fee', amount: 0.05, createdAt: moment().subtract(5, 'days'),
        });
        await PaymentHistoryFactory.Create({
          main_object: object.author_permlink, review_object: object.author_permlink, permlink: review2.details.reservation_permlink, userName: 'app', sponsor: 'sponsor1', type: 'referral_server_fee', amount: 0.05, createdAt: moment().subtract(5, 'days'),
        });
        await PaymentHistoryFactory.Create({
          main_object: object.author_permlink, review_object: object.author_permlink, permlink: review2.details.reservation_permlink, userName: 'beneficiar', sponsor: 'sponsor2', type: 'beneficiary_fee', amount: 2, createdAt: moment().subtract(4, 'days'),
        });
        const review3 = await PaymentHistoryFactory.Create({
          main_object: object.author_permlink, review_object: object.author_permlink, userName: 'user1', sponsor: 'sponsor2', type: 'review', amount: 18, createdAt: moment().subtract(4, 'days'),
        });
        await PaymentHistoryFactory.Create({
          main_object: object.author_permlink, review_object: object.author_permlink, permlink: review3.details.reservation_permlink, userName: 'waivio', sponsor: 'sponsor2', type: 'index_fee', amount: 0.1, createdAt: moment().subtract(4, 'days'),
        });
        await PaymentHistoryFactory.Create({
          main_object: object.author_permlink, review_object: object.author_permlink, permlink: review3.details.reservation_permlink, userName: 'app', sponsor: 'sponsor2', type: 'campaign_server_fee', amount: 0.05, createdAt: moment().subtract(4, 'days'),
        });
        await PaymentHistoryFactory.Create({
          main_object: object.author_permlink, review_object: object.author_permlink, permlink: review3.details.reservation_permlink, userName: 'app', sponsor: 'sponsor2', type: 'referral_server_fee', amount: 0.05, createdAt: moment().subtract(4, 'days'),
        });
      });
      it('should get receivables by beneficiar with wrapper', async () => {
        const res = await chai.request(app)
          .post('/campaigns-api/payments/payables')
          .send({ userName: 'beneficiar' });
        res.should.have.status(200);
        res.body.histories.length.should.to.be.eq(2);
        res.body.payable.should.to.be.eq(5);
        res.body.histories[0].payable.should.to.be.eq(3);
        res.body.histories[1].payable.should.to.be.eq(2);
      });
      it('should get payables by sponsor1 with wrapper', async () => {
        const res = await chai.request(app)
          .post('/campaigns-api/payments/payables')
          .send({ sponsor: 'sponsor1' });
        res.should.have.status(200);
        res.body.histories.length.should.to.be.eq(4);
        res.body.payable.should.to.be.eq(30.3);
        _.round(res.body.histories[0].payable, 2).should.to.be.eq(27);
        _.round(res.body.histories[1].payable, 2).should.to.be.eq(3);
        _.round(res.body.histories[2].payable, 2).should.to.be.eq(0.15);
        _.round(res.body.histories[3].payable, 2).should.to.be.eq(0.15);
      });
      it('should get payables by sponsor2 with wrapper', async () => {
        const res = await chai.request(app)
          .post('/campaigns-api/payments/payables')
          .send({ sponsor: 'sponsor2' });
        res.should.have.status(200);
        res.body.histories.length.should.to.be.eq(4);
        res.body.payable.should.to.be.eq(20.201);
        _.round(res.body.histories[0].payable, 2).should.to.be.eq(18);
        _.round(res.body.histories[1].payable, 2).should.to.be.eq(2);
        _.round(res.body.histories[2].payable, 2).should.to.be.eq(0.1);
        _.round(res.body.histories[3].payable, 2).should.to.be.eq(0.1);
      });
      it('should get payables by sponsor1 and beneficiar without wrapper', async () => {
        const res = await chai.request(app)
          .post('/campaigns-api/payments/payables')
          .send({ sponsor: 'sponsor1', userName: 'beneficiar' });
        res.should.have.status(200);
        res.body.histories.length.should.to.be.eq(2);
        res.body.payable.should.to.be.eq(3);
        [res.body.histories[0].amount, res.body.histories[0].balance].should.to.be.eql([2, 3]);
        [res.body.histories[1].amount, res.body.histories[1].balance].should.to.be.eql([1, 1]);
      });
      it('should get payables by sponsor2 and beneficiar without wrapper', async () => {
        const res = await chai.request(app)
          .post('/campaigns-api/payments/payables')
          .send({ sponsor: 'sponsor2', userName: 'beneficiar' });
        res.should.have.status(200);
        res.body.histories.length.should.to.be.eq(1);
        res.body.payable.should.to.be.eq(2);
        [_.round(res.body.histories[0].amount, 2),
          _.round(res.body.histories[0].balance, 2)].should.to.be.eql([2, 2]);
      });
    });
    describe('demo payables', async () => {
      before(async () => {
        await dropDatabase();
        await PaymentHistoryFactory.Create({
          userName: 'user1', sponsor: 'sponsor1', type: 'demo_post', amount: 2, createdAt: moment().subtract(10, 'days'),
        });
        await PaymentHistoryFactory.Create({
          userName: 'user2', sponsor: 'sponsor1', type: 'demo_post', amount: 4, createdAt: moment().subtract(9, 'days'),
        });
        await PaymentHistoryFactory.Create({
          userName: 'user1', sponsor: 'sponsor1', type: 'demo_user_transfer', amount: 2, createdAt: moment().subtract(8, 'days'),
        });
        await PaymentHistoryFactory.Create({
          userName: 'user2', sponsor: 'sponsor2', type: 'demo_post', amount: 7.5, createdAt: moment().subtract(6, 'days'),
        });
        await PaymentHistoryFactory.Create({
          userName: 'user1', sponsor: 'sponsor1', type: 'demo_post', amount: 2, createdAt: moment().subtract(6, 'days'),
        });
        await PaymentHistoryFactory.Create({
          userName: 'user2', sponsor: 'sponsor2', type: 'demo_user_transfer', amount: 7, createdAt: moment().subtract(5, 'days'),
        });
      });
      it('should get demo payables by user1', async () => {
        const result = await chai.request(app).get('/campaigns-api/payments/demo_payables?userName=user1');
        result.should.have.status(200);
        result.body.histories.length.should.to.be.eq(3);
        result.body.payable.should.to.be.eq(2);
      });

      it('should get demo payables by user1 with limit', async () => {
        const result = await chai.request(app).get('/campaigns-api/payments/demo_payables?userName=user1&limit=1');
        result.should.have.status(200);
        result.body.histories.length.should.to.be.eq(1);
        result.body.payable.should.to.be.eq(2);
      });

      it('should get demo payables by user1 with skip', async () => {
        const result = await chai.request(app).get('/campaigns-api/payments/demo_payables?userName=user1&skip=1');
        result.should.have.status(200);
        result.body.histories.length.should.to.be.eq(2);
        result.body.payable.should.to.be.eq(2);
      });

      it('should get demo payables by user1 with skip and limit', async () => {
        const result = await chai.request(app).get('/campaigns-api/payments/demo_payables?userName=user1&skip=1&limit=1');
        result.should.have.status(200);
        result.body.histories.length.should.to.be.eq(1);
        result.body.payable.should.to.be.eq(2);
      });

      it('should get demo payables by user2', async () => {
        const result = await chai.request(app).get('/campaigns-api/payments/demo_payables?userName=user2');
        result.should.have.status(200);
        result.body.histories.length.should.to.be.eq(3);
        result.body.payable.should.to.be.eq(4.5);
      });
    });
    describe('On global report', async () => {
      let sponsor, countRewardPayments, object, reward;
      beforeEach(async () => {
        await dropDatabase();
        reward = _.random(5, 20);
        object = WobjectFactory.Create();
        countRewardPayments = _.random(5, 20);
        sponsor = faker.name.firstName();
        for (let count = 0; count < countRewardPayments; count++) {
          await PaymentHistoryFactory.Create(
            {
              sponsor, amount: reward, main_object: object.author_permlink, createdAt: moment.utc().subtract(2, 'hour'),
            },
          );
          await PaymentHistoryFactory.Create(
            {
              sponsor, amount: reward, main_object: object.author_permlink, type: 'index_fee', createdAt: moment.utc().subtract(2, 'hour'),
            },
          );
          await PaymentHistoryFactory.Create({ main_object: object.author_permlink, createdAt: moment.utc().subtract(2, 'hour') });
        }
      });
      afterEach(() => {
        sinon.restore();
      });
      describe('On OK', async () => {
        let requestBody;
        beforeEach(async () => {
          requestBody = {
            sponsor,
            payable: reward * countRewardPayments * 2,
            globalReport: true,
            startDate: Math.round(moment.utc().subtract(2, 'day').valueOf() / 1000),
          };
        });
        describe('On request without filters', async () => {
          let result;
          beforeEach(async () => {
            result = await chai.request(app)
              .post('/campaigns-api/payments/payables')
              .send(_.omit(requestBody, ['createdAt']));
          });
          it('should return status 200', async () => {
            expect(result).to.have.status(200);
          });
          it('should return correct amount for current sponsor', async () => {
            expect(result.body.amount).to.be.eq(reward * countRewardPayments);
          });
          it('should return right count of records', async () => {
            expect(result.body.histories.length).to.be.eq(countRewardPayments);
          });
          it('should return histories only for one sponsor', async () => {
            const sponsors = _.uniq(_.map(result.body.histories, 'sponsor'));
            expect(sponsors.length).to.be.eq(1);
          });
          it('should return histories only for current sponsor', async () => {
            const sponsorName = _.uniq(_.map(result.body.histories, 'sponsor'))[0];
            expect(sponsorName).to.be.eq(sponsor);
          });
          it('should return only histories with type review', async () => {
            const types = _.uniq(_.map(result.body.histories, 'type'));
            expect(types.length).to.be.eq(1);
          });
        });
        describe('On request with start date filter', async () => {
          let result, oldHistory;
          beforeEach(async () => {
            oldHistory = await PaymentHistoryFactory.Create({ sponsor, createdAt: moment.utc().subtract(2, 'month') });
            result = await chai.request(app)
              .post('/campaigns-api/payments/payables')
              .send(requestBody);
          });
          it('should return right count of histories only in a given period of time', async () => {
            expect(result.body.histories.length).to.be.eq(countRewardPayments);
          });
          it('should not return oldHistory', async () => {
            const data = _.find(result.body.histories,
              (history) => history.details.reservation_permlink === oldHistory.details.reservation_permlink);
            expect(data).to.be.undefined;
          });
          it('should return right amount of histories', async () => {
            expect(result.body.amount).to.be.eq(reward * countRewardPayments);
          });
        });
        describe('On request with end date filter', async () => {
          let result, newHistory;
          beforeEach(async () => {
            newHistory = await PaymentHistoryFactory.Create({ sponsor, createdAt: moment.utc().subtract(2, 'minute') });
            result = await chai.request(app)
              .post('/campaigns-api/payments/payables')
              .send(Object.assign(requestBody, { endDate: Math.round(moment.utc().subtract(1, 'hour') / 1000) }));
          });
          it('should return right count of histories only in a given period of time without new history', async () => {
            expect(result.body.histories.length).to.be.eq(countRewardPayments);
          });
          it('should not return newHistory', async () => {
            const data = _.find(result.body.histories,
              (history) => history.details.reservation_permlink === newHistory.details.reservation_permlink);
            expect(data).to.be.undefined;
          });
          it('should return right amount of histories', async () => {
            expect(result.body.amount).to.be.eq(reward * countRewardPayments);
          });
        });
        describe('On request with payment filter', async () => {
          let result, littleHistory;
          beforeEach(async () => {
            requestBody.payable = 1;
            littleHistory = await PaymentHistoryFactory.Create({ sponsor, amount: 1, createdAt: moment.utc().subtract(1, 'day') });
            result = await chai.request(app)
              .post('/campaigns-api/payments/payables')
              .send(requestBody);
          });
          it('should return only history with small reward', async () => {
            expect(result.body.histories.length).to.be.eq(1);
          });
          it('should return right amount of histories', async () => {
            expect(result.body.amount).to.be.eq(1);
          });
          it('should return right history reservation permlink', async () => {
            const permlink = _.find(result.body.histories,
              (history) => history.details.reservation_permlink === littleHistory.details.reservation_permlink);
            expect(permlink).to.be.exist;
          });
        });
        describe('On request with processingFee', async () => {
          let result;
          beforeEach(async () => {
            result = await chai.request(app)
              .post('/campaigns-api/payments/payables')
              .send(Object.assign(requestBody, { processingFees: true }));
          });
          // it('should return all payment histories for current sponsor', async () => {
          //   expect(result.body.histories.length).to.be.eq(countRewardPayments * 2);
          // });
          it('should return correct amount of all histories', async () => {
            expect(result.body.amount).to.be.eq((reward * countRewardPayments) * 2);
          });
          it('should will not take into account the payment of the sponsor', async () => {
            await PaymentHistoryFactory.Create({ sponsor, createdAt: moment.utc().subtract(1, 'hour'), type: 'transfer' });
            expect(result.body.amount).to.be.eq((reward * countRewardPayments) * 2);
          });
          it('should return all types of histories', async () => {
            const types = _.uniq(_.map(result.body.histories, 'type'));
            expect(types.length).to.be.eq(2);
          });
        });
        describe('On request with USD currency', async () => {
          let result;
          beforeEach(async () => {
            result = await chai.request(app)
              .post('/campaigns-api/payments/payables')
              .send(Object.assign(requestBody, { currency: 'usd' }));
          });
          it('should return correct amount of histories', async () => {
            expect(result.body.amount).to.be.eq((reward * countRewardPayments) / 2);
          });
          it('should return all payment histories for current sponsor', async () => {
            expect(result.body.histories.length).to.be.eq(countRewardPayments);
          });
        });
        describe('On request with required objects', async () => {
          let result, newObject, history;
          beforeEach(async () => {
            newObject = await WobjectFactory.Create();
            history = await PaymentHistoryFactory.Create({ sponsor, createdAt: moment.utc().subtract(2, 'minute'), main_object: newObject.author_permlink });
            result = await chai.request(app)
              .post('/campaigns-api/payments/payables')
              .send(Object.assign(requestBody, { objects: [newObject.author_permlink] }));
          });
          it('should return only one record with required object', async () => {
            expect(result.body.histories.length).to.be.eq(1);
          });
          it('should return right amount', async () => {
            expect(result.body.amount).to.be.eq(history.amount);
          });
          it('should return right history reservation permlink', async () => {
            const permlink = _.find(result.body.histories,
              (histor) => histor.details.reservation_permlink === history.details.reservation_permlink);
            expect(permlink).to.be.exist;
          });
        });
        describe('On request with skip and limit', async () => {
          let newHistory, resultSkip, resultLimit;
          beforeEach(async () => {
            newHistory = await PaymentHistoryFactory.Create({ sponsor, createdAt: moment.utc().subtract(3, 'minute') });
            resultLimit = await chai.request(app)
              .post('/campaigns-api/payments/payables')
              .send(Object.assign(requestBody, { limit: 3 }));
            resultSkip = await chai.request(app)
              .post('/campaigns-api/payments/payables')
              .send(Object.assign(requestBody, { skip: 1 }));
          });
          it('should skip first element of history', async () => {
            const permlink = _.find(resultSkip.body.histories,
              (history) => history.details.reservation_permlink === newHistory.details.reservation_permlink);
            expect(permlink).to.be.undefined;
          });
          it('should add amount of payment skipped document to common ammount', async () => {
            expect(resultSkip.body.amount).to.be.eq(
              (reward * countRewardPayments) + newHistory.amount,
            );
          });
          it('should return result with limit', async () => {
            expect(resultLimit.body.histories.length).to.be.eq(3);
          });
          it('should return flag hasMore - true', async () => {
            expect(resultLimit.body.hasMore).to.be.true;
          });
          it('should return correct history document in first place', async () => {
            expect(resultLimit.body.histories[0].details.reservation_permlink)
              .to.be.eq(newHistory.details.reservation_permlink);
          });
        });
        describe('Another OK result', async () => {
          let result;
          beforeEach(async () => {
            result = await chai.request(app)
              .post('/campaigns-api/payments/payables')
              .send(Object.assign(requestBody, { sponsor: faker.name.firstName() }));
          });
          it('should return empty array of histories if sponsor not find', async () => {
            expect(result.body.histories).to.be.empty;
          });
          it('should return zero amount', async () => {
            expect(result.body.amount).to.be.eq(0);
          });
        });
      });
      describe('On ERRORS', async () => {
        describe('On database errors', async () => {
          let result;
          beforeEach(async () => {
            sinon.stub(PaymentHistory, 'aggregate').throws({ message: 'test error' });
            result = await chai.request(app)
              .post('/campaigns-api/payments/payables')
              .send({ sponsor: faker.name.firstName() });
          });
          it('should return 500 status', async () => {
            expect(result).to.have.status(500);
          });
          it('should return correct error message', async () => {
            expect(result.body.message).to.be.eq('test error');
          });
        });
        describe('On validation errors', async () => {
          describe('Without sponsor', async () => {
            let result;
            beforeEach(async () => {
              sinon.stub(PaymentHistory, 'aggregate').throws({ message: 'test error' });
              result = await chai.request(app)
                .post('/campaigns-api/payments/payables')
                .send({ globalReport: true });
            });
            it('should return 422 status', async () => {
              expect(result).to.have.status(422);
            });
            it('should return correct error message', async () => {
              expect(result.body.message).to.be.eq('One of userName or sponsor is required!');
            });
          });
          describe('On incorrect date', async () => {
            let result;
            beforeEach(async () => {
              sinon.stub(PaymentHistory, 'aggregate').throws({ message: 'test error' });
              result = await chai.request(app)
                .post('/campaigns-api/payments/payables')
                .send({ startDate: moment.utc().add(1, 'day') });
            });
            it('should return 422 status', async () => {
              expect(result).to.have.status(422);
            });
          });
        });
      });
    });
  });
});
