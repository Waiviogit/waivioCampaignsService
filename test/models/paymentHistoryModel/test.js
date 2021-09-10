const _ = require('lodash');
const moment = require('moment');
const {
  paymentHistoryModel, expect, dropDatabase, PaymentHistory,
} = require('test/testHelper');
const { getDemoDebtHistory, getPayableHistory } = require('utilities/operations/paymentHistory');
const { UserFactory, PaymentHistoryFactory, WobjectFactory } = require('test/factories');

describe('get demo payables history', async () => {
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
    await PaymentHistoryFactory.Create({
      userName: 'user2', sponsor: 'sponsor2', type: 'demo_debt', amount: 1.2, createdAt: moment().subtract(5, 'days'),
    });
  });

  describe('without wrapper demo payables', async () => {
    it('should get user1 demo payables without limit and skip', async () => {
      const { histories, payable } = await getDemoDebtHistory({ userName: 'user1', skip: 0, limit: 30 });

      expect(histories.length).to.be.eq(3);
      expect(payable).to.be.eq(2);
    });

    it('should get user1 demo payables with limit', async () => {
      const { histories, payable } = await getDemoDebtHistory({ userName: 'user1', skip: 0, limit: 1 });

      expect(histories.length).to.be.eq(1);
      expect(payable).to.be.eq(2);
    });

    it('should get user1 demo payables with skip', async () => {
      const { histories, payable } = await getDemoDebtHistory({ userName: 'user1', skip: 2, limit: 10 });

      expect(histories.length).to.be.eq(1);
      expect(payable).to.be.eq(2);
    });

    it('should get user1 demo payables with skip nad limit', async () => {
      const { histories, payable } = await getDemoDebtHistory({ userName: 'user1', skip: 1, limit: 1 });

      expect(histories.length).to.be.eq(1);
      expect(payable).to.be.eq(2);
    });

    it('check created at order', async () => {
      const { histories } = await getDemoDebtHistory({ userName: 'user1', skip: 0, limit: 30 });

      expect(histories[0].createdAt > histories[1].createdAt).to.be.true;
      expect(histories[1].createdAt > histories[2].createdAt).to.be.true;
    });

    it('should get user2 demo payables without limit and skip', async () => {
      const { histories, payable } = await getDemoDebtHistory({ userName: 'user2', skip: 0, limit: 30 });

      expect(histories.length).to.be.eq(4);
      expect(payable).to.be.eq(5.7);
    });
  });
});
describe('get payables history', async () => {
  before(async () => {
    await dropDatabase();
    const object = await WobjectFactory.Create();
    await PaymentHistoryFactory.Create({
      main_object: object.author_permlink, review_object: object.author_permlink, userName: 'user1', sponsor: 'sponsor1', type: 'review', amount: 2, createdAt: moment().subtract(9, 'days'),
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
      main_object: object.author_permlink, review_object: object.author_permlink, userName: 'user1', sponsor: 'sponsor1', type: 'review', amount: 2, createdAt: moment().subtract(8, 'days'),
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
    await PaymentHistoryFactory.Create({
      userName: 'user4', sponsor: 'sponsor1', type: 'demo_debt', amount: 1.2, createdAt: moment().subtract(2, 'days'),
    });
  });
  describe('with wrapper receivables', async () => {
    it('should get receivables by user1 without limit and skip', async () => {
      const { histories, payable } = await getPayableHistory({
        userName: 'user1', skip: 0, limit: 30, days: 0, payable: 0,
      });

      expect(histories.length).to.be.eq(1);
      expect(_.omit(histories[0], ['lastCreatedAt', 'payed'])).to.be.eql({ payable: 2, guideName: 'sponsor1' });
      expect(payable).to.be.eq(2);
    });

    it('should get receivables by user2 without limit and skip', async () => {
      const { histories, payable } = await getPayableHistory({
        userName: 'user2', skip: 0, limit: 30, days: 0, payable: 0,
      });

      expect(histories.length).to.be.eq(2);
      expect(_.omit(histories[0], ['lastCreatedAt', 'payed'])).to.be.eql({ payable: 4, guideName: 'sponsor1' });
      expect(_.omit(histories[1], ['lastCreatedAt', 'payed'])).to.be.eql({ payable: 0.5, guideName: 'sponsor2' });
      expect(payable).to.be.eq(4.5);
    });

    it('should get receivables by user3 without limit and skip', async () => {
      const { histories, payable } = await getPayableHistory({
        userName: 'user3', skip: 0, limit: 30, days: 0, payable: 0,
      });

      expect(histories.length).to.be.eq(1);
      expect(_.omit(histories[0], ['lastCreatedAt', 'payed', 'notPayedPeriod'])).to.be.eql({ payable: 160, guideName: 'sponsor1' });
      expect(payable).to.be.eq(160);
    });

    it('should get receivables by user4 without limit and skip', async () => {
      const { payable } = await getPayableHistory({
        userName: 'user4', skip: 0, limit: 30, days: 0, payable: 0,
      });

      expect(payable).to.be.eq(-31.2);
    });

    it('check filter by payable', async () => {
      const { histories, payable } = await getPayableHistory({
        userName: 'user2', payable: 4, skip: 0, limit: 30, days: 0,
      });

      expect(histories.length).to.be.eq(1);
      expect(payable).to.be.eq(4);
    });

    it('check filter by date', async () => {
      const { histories, payable } = await getPayableHistory({
        userName: 'user2', days: 8, skip: 0, limit: 30, payable: 0,
      });

      expect(histories.length).to.be.eq(1);
      expect(payable).to.be.eq(4);
    });

    it('check filter by date and payable', async () => {
      const { histories, payable } = await getPayableHistory({
        userName: 'user2', days: 8, payable: 4, limit: 30, skip: 0,
      });

      expect(histories.length).to.be.eq(1);
      expect(payable).to.be.eq(4);
    });

    describe('check limit', async () => {
      it('check limit', async () => {
        const { histories, payable } = await getPayableHistory({
          userName: 'user2', limit: 1, days: 0, payable: 0, skip: 0,
        });

        expect(histories.length).to.be.eq(1);
        expect(payable).to.be.eq(4.5);
      });

      it('check skip', async () => {
        const { histories, payable } = await getPayableHistory({
          userName: 'user2', skip: 1, limit: 30, days: 0, payable: 0,
        });

        expect(histories.length).to.be.eq(1);
        expect(payable).to.be.eq(4.5);
      });

      it('check skip over records', async () => {
        const { histories, payable } = await getPayableHistory({
          userName: 'user2', skip: 2, limit: 50, days: 0, payable: 0,
        });

        expect(histories.length).to.be.eq(0);
        expect(payable).to.be.eq(4.5);
      });
    });
  });
  describe('without wrapper payables', async () => {
    it('should get user1 sponsor1 payables without limit and skip', async () => {
      const { histories, payable } = await getPayableHistory({
        sponsor: 'sponsor1', userName: 'user1', skip: 0, limit: 30, days: 0, payable: 0,
      });

      expect(histories.length).to.be.eq(3);
      expect(payable).to.be.eq(2);
    });

    it('check created at order', async () => {
      const { histories } = await getPayableHistory({
        sponsor: 'sponsor1', userName: 'user1', skip: 0, limit: 30, days: 0, payable: 0,
      });

      expect(histories[0].createdAt > histories[1].createdAt).to.be.true;
      expect(histories[1].createdAt > histories[2].createdAt).to.be.true;
    });

    it('should get user2 sponsor1 payables without limit and skip', async () => {
      const { histories, payable } = await getPayableHistory({
        sponsor: 'sponsor1', userName: 'user2', skip: 0, limit: 30, days: 0, payable: 0,
      });

      expect(histories.length).to.be.eq(1);
      expect(payable).to.be.eq(4);
    });

    it('should get user2 sponsor2 payables without limit and skip', async () => {
      const { histories, payable } = await getPayableHistory({
        sponsor: 'sponsor2', userName: 'user2', skip: 0, limit: 30, days: 0, payable: 0,
      });

      expect(histories.length).to.be.eq(2);
      expect(payable).to.be.eq(0.5);
    });

    it('should get only review', async () => {
      const { histories, payable } = await getPayableHistory({
        sponsor: 'sponsor1', userName: 'user3', skip: 0, limit: 30, days: 0, payable: 0,
      });

      expect(histories.length).to.be.eq(2);
      expect(payable).to.be.eq(160);
    });

    it('should get only transfer with demo debt', async () => {
      const { histories, payable } = await getPayableHistory({
        sponsor: 'sponsor1', userName: 'user4', skip: 0, limit: 30, days: 0, payable: 0,
      });

      expect(histories.length).to.be.eq(3);
      expect(payable).to.be.eq(-31.2);
    });
    describe('check skip limit', async () => {
      before(async () => {
        await UserFactory.Create({ name: 'sponsor3' });
        await UserFactory.Create({ name: 'user5' });
        for (let i = 0; i < 45; i++) {
          await PaymentHistoryFactory.Create({
            userName: 'user5', sponsor: 'sponsor3', type: 'review', amount: i + 1, createdAt: moment().subtract(46 - i, 'days'),
          });
        }
      });
      it('check limit', async () => {
        const { histories, payable } = await getPayableHistory({
          sponsor: 'sponsor3', userName: 'user5', limit: 5, skip: 0, days: 0, payable: 0,
        });

        expect(histories.length).to.be.eq(5);
        expect(payable).to.be.eq(1035);
      });

      it('check skip', async () => {
        const { histories, payable } = await getPayableHistory({
          sponsor: 'sponsor3', userName: 'user5', skip: 5, limit: 30, days: 0, payable: 0,
        });

        expect(histories.length).to.be.eq(30);
        expect(histories[0].balance).to.be.eq(820);
        expect(payable).to.be.eq(1035);
      });

      it('check skip with limit', async () => {
        const { histories, payable } = await getPayableHistory({
          sponsor: 'sponsor3', userName: 'user5', skip: 5, limit: 5, days: 0, payable: 0,
        });

        expect(histories.length).to.be.eq(5);
        expect(histories[0].balance).to.be.eq(820);
        expect(payable).to.be.eq(1035);
      });

      it('check skip last record', async () => {
        const { histories, payable } = await getPayableHistory({
          sponsor: 'sponsor3', userName: 'user5', skip: 44, limit: 50, days: 0, payable: 0,
        });

        expect(histories.length).to.be.eq(1);
        expect(histories[0].balance).to.be.eq(1);
        expect(payable).to.be.eq(1035);
      });

      it('check skip over records', async () => {
        const { histories, payable } = await getPayableHistory({
          sponsor: 'sponsor3', userName: 'user5', skip: 45, limit: 50, days: 0, payable: 0,
        });

        expect(histories.length).to.be.eq(0);
        expect(payable).to.be.eq(1035);
      });
    });
  });
  describe('with wrapper payables', async () => {
    it('should get sponsor1 with many users payables without limit and skip', async () => {
      const { histories, payable } = await getPayableHistory({
        sponsor: 'sponsor1', skip: 0, limit: 30, days: 0, payable: 0,
      });

      expect(histories.length).to.be.eq(4);
      expect(_.omit(histories[0], ['lastCreatedAt', 'payed', 'notPayedPeriod'])).to.be.eql({ payable: 160, userName: 'user3' });
      expect(_.omit(histories[1], ['lastCreatedAt', 'payed', 'notPayedPeriod'])).to.be.eql({ payable: 4, userName: 'user2' });
      expect(_.omit(histories[2], ['lastCreatedAt', 'payed', 'notPayedPeriod'])).to.be.eql({ payable: 2, userName: 'user1' });
      expect(_.omit(histories[3], ['lastCreatedAt', 'payed', 'notPayedPeriod'])).to.be.eql({ payable: -31.2, userName: 'user4' });
      expect(payable).to.be.eq(134.8);
    });

    it('check sort by oldest', async () => {
      const { histories, payable } = await getPayableHistory({
        sponsor: 'sponsor1', sort: 'date', skip: 0, limit: 30, days: 0, payable: 0,
      });

      expect(histories.length).to.be.eq(4);
      expect(_.omit(histories[2], ['lastCreatedAt', 'payed', 'notPayedPeriod'])).to.be.eql({ payable: 2, userName: 'user1' });
      expect(_.omit(histories[3], ['lastCreatedAt', 'payed', 'notPayedPeriod'])).to.be.eql({ payable: 4, userName: 'user2' });
      expect(_.omit(histories[1], ['lastCreatedAt', 'payed', 'notPayedPeriod'])).to.be.eql({ payable: 160, userName: 'user3' });
      expect(_.omit(histories[0], ['lastCreatedAt', 'payed', 'notPayedPeriod'])).to.be.eql({ payable: -31.2, userName: 'user4' });
      expect(payable).to.be.eq(134.8);
    });

    it('check sort by payable', async () => {
      const { histories, payable } = await getPayableHistory({
        sponsor: 'sponsor1', sort: 'payable', skip: 0, limit: 30, days: 0, payable: 0,
      });

      expect(histories.length).to.be.eq(4);
      expect(_.omit(histories[0], ['lastCreatedAt', 'payed', 'notPayedPeriod'])).to.be.eql({ payable: 160, userName: 'user3' });
      expect(_.omit(histories[1], ['lastCreatedAt', 'payed', 'notPayedPeriod'])).to.be.eql({ payable: 4, userName: 'user2' });
      expect(_.omit(histories[2], ['lastCreatedAt', 'payed', 'notPayedPeriod'])).to.be.eql({ payable: 2, userName: 'user1' });
      expect(_.omit(histories[3], ['lastCreatedAt', 'payed', 'notPayedPeriod'])).to.be.eql({ payable: -31.2, userName: 'user4' });
      expect(payable).to.be.eq(134.8);
    });

    it('should get sponsor2 payables without limit and skip', async () => {
      const { histories, payable } = await getPayableHistory({
        sponsor: 'sponsor2', skip: 0, limit: 30, days: 0, payable: 0,
      });

      expect(histories.length).to.be.eq(1);
      expect(histories[0].payable).to.be.eq(0.5);
      expect(payable).to.be.eq(0.5);
    });

    it('check filter by payable', async () => {
      const { histories, payable } = await getPayableHistory({
        sponsor: 'sponsor1', payable: 45, skip: 0, limit: 30, days: 0,
      });

      expect(histories.length).to.be.eq(1);
      expect(payable).to.be.eq(160);
    });

    it('check filter by payable with negative value', async () => {
      const { histories, payable } = await getPayableHistory({
        sponsor: 'sponsor1', payable: -15, skip: 0, limit: 30, days: 0,
      });

      expect(histories.length).to.be.eq(3);
      expect(payable).to.be.eq(166);
    });

    it('check filter by date', async () => {
      const { histories, payable } = await getPayableHistory({
        sponsor: 'sponsor1', days: 3, skip: 0, limit: 30, payable: 0,
      });

      expect(histories.length).to.be.eq(3);
      expect(payable).to.be.eq(166);
    });

    it('check filter by date with many days', async () => {
      const { histories, payable } = await getPayableHistory({
        sponsor: 'sponsor1', days: 9, skip: 0, limit: 30, payable: 0,
      });

      expect(histories.length).to.be.eq(2);
      expect(_.omit(histories[0], ['lastCreatedAt', 'payed', 'notPayedPeriod'])).to.be.eql({ payable: 4, userName: 'user2' });
      expect(payable).to.be.eq(6);
    });

    it('check filter by date with negative value', async () => {
      const { histories, payable } = await getPayableHistory({
        sponsor: 'sponsor1', days: -3, skip: 0, limit: 30, payable: 0,
      });

      expect(histories.length).to.be.eq(3);
      expect(payable).to.be.eq(166);
    });

    it('check filter by date and payable', async () => {
      const { histories, payable } = await getPayableHistory({
        sponsor: 'sponsor1', days: 3, payable: 30, skip: 0, limit: 30,
      });

      expect(histories.length).to.be.eq(1);
      expect(payable).to.be.eq(160);
    });

    describe('check skip limit', async () => {
      it('check limit', async () => {
        const { histories, payable } = await getPayableHistory({
          sponsor: 'sponsor1', limit: 2, skip: 0, days: 0, payable: 0,
        });

        expect(histories.length).to.be.eq(2);
        expect(payable).to.be.eq(134.8);
      });

      it('check skip', async () => {
        const { histories, payable } = await getPayableHistory({
          sponsor: 'sponsor1', skip: 2, limit: 30, days: 0, payable: 0,
        });

        expect(histories.length).to.be.eq(2);
        expect(histories[0].payable).to.be.eq(2);
        expect(histories[1].payable).to.be.eq(-31.2);
        expect(payable).to.be.eq(134.8);
      });

      it('check skip with limit', async () => {
        const { histories, payable } = await getPayableHistory({
          sponsor: 'sponsor1', skip: 1, limit: 2, days: 0, payable: 0,
        });

        expect(histories.length).to.be.eq(2);
        expect(histories[0].payable).to.be.eq(4);
        expect(histories[1].payable).to.be.eq(2);
        expect(payable).to.be.eq(134.8);
      });

      it('check skip last record', async () => {
        const { histories, payable } = await getPayableHistory({
          sponsor: 'sponsor1', skip: 3, limit: 50, days: 0, payable: 0,
        });

        expect(histories.length).to.be.eq(1);
        expect(histories[0].payable).to.be.eq(-31.2);
        expect(payable).to.be.eq(134.8);
      });

      it('check skip over records', async () => {
        const { histories, payable } = await getPayableHistory({ sponsor: 'sponsor1', skip: 4, limit: 50 });

        expect(histories.length).to.be.eq(0);
        expect(payable).to.be.eq(134.8);
      });
    });
    describe('check notPayedPeriod counter', async () => {
      let histories;
      const notPayedPeriod = _.random(1, 8);
      beforeEach(async () => {
        await paymentHistoryModel.updateOne({ sponsor: 'sponsor1', userName: 'user2' }, { payed: true });
        const object = await WobjectFactory.Create();
        await PaymentHistoryFactory.Create({
          main_object: object.author_permlink, review_object: object.author_permlink, userName: 'user2', sponsor: 'sponsor1', type: 'review', amount: 4, createdAt: moment().subtract(notPayedPeriod, 'days'),
        });
        ({ histories } = await getPayableHistory({
          sponsor: 'sponsor1', skip: 0, limit: 30, days: 0, payable: 0,
        }));
      });
      it('should be eq notPayedPeriod', async () => {
        const user = _.find(histories, (el) => el.userName === 'user2');
        expect(user.notPayedPeriod).to.be.eq(notPayedPeriod);
      });
    });
  });
});
describe('updateAmount', async () => {
  let payment;
  beforeEach(async () => {
    await dropDatabase();
    payment = await PaymentHistoryFactory.Create({
      amount: 2, createdAt: moment().subtract(10, 'days'),
    });
  });
  it('should update amount and recounted', async () => {
    await paymentHistoryModel.updateAmount({
      type: payment.type,
      userName: payment.userName,
      sponsor: payment.sponsor,
      amount: 1.2,
      reservationPermlink: payment.details.reservation_permlink,
    });
    const history = await PaymentHistory.findOne(
      { userName: payment.userName, sponsor: payment.sponsor },
    );
    expect(history.amount).to.be.eq(0.8);
    expect(history.recounted).to.be.eq(true);
  });

  it('should update only recounted', async () => {
    await paymentHistoryModel.updateAmount({
      type: payment.type,
      userName: payment.userName,
      sponsor: payment.sponsor,
      reservationPermlink: payment.details.reservation_permlink,
    });
    const history = await PaymentHistory.findOne(
      { userName: payment.userName, sponsor: payment.sponsor },
    );

    expect(history.amount).to.be.eq(2);
    expect(history.recounted).to.be.eq(true);
  });

  it('should not update with invalid status', async () => {
    await paymentHistoryModel.updateAmount({ type: 'aaa', author: 'user1', sponsor: 'sponsor1' });
    const history = await PaymentHistory.findOne(
      { userName: payment.userName, sponsor: payment.sponsor },
    );

    expect(history.amount).to.be.eq(2);
    expect(history.recounted).to.be.eq(false);
  });

  it('should not update with invalid user', async () => {
    await paymentHistoryModel.updateAmount({ type: 'review', author: 'aaa', sponsor: 'sponsor1' });
    const history = await PaymentHistory.findOne(
      { userName: payment.userName, sponsor: payment.sponsor },
    );

    expect(history.amount).to.be.eq(2);
    expect(history.recounted).to.be.eq(false);
  });

  it('should not update with invalid sponsor', async () => {
    await paymentHistoryModel.updateAmount({ type: 'review', author: 'user1', sponsor: 'aaa' });
    const history = await PaymentHistory.findOne(
      { userName: payment.userName, sponsor: payment.sponsor },
    );

    expect(history.amount).to.be.eq(2);
    expect(history.recounted).to.be.eq(false);
  });
});
