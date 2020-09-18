const {
  expect, faker, dropDatabase, Campaign, _, moment, PaymentHistory, transferHelper, campaignHelper, campaignModel,
} = require('test/testHelper');
const { CampaignFactory, PaymentHistoryFactory } = require('test/factories');
const { CAMPAIGN_STATUSES, RESERVATION_STATUSES } = require('constants/constants');

describe('on CampaignsHelper', async () => {
  describe('on recountDebtAfterTransfer', async () => {
    let campaign, amount, userName, payment;
    beforeEach(async () => {
      amount = _.random(1, 20);
      userName = faker.name.firstName();
      await dropDatabase();
      campaign = await CampaignFactory.Create();
      payment = await PaymentHistoryFactory.Create(
        { sponsor: campaign.guideName, userName, amount },
      );
    });
    describe('with 1 payment and transfer>amount', async () => {
      let updatedHistory;
      beforeEach(async () => {
        await transferHelper.recountDebtAfterTransfer(
          { guideName: campaign.guideName, amount, userName },
        );
        updatedHistory = await PaymentHistory.findOne({ _id: payment._id }).lean();
      });
      it('should change payment status to payed', async () => {
        expect(updatedHistory.payed).to.be.eq(true);
      });
    });
    describe('with many payments and transfer>amount', async () => {
      let notPayedHistories;
      beforeEach(async () => {
        await PaymentHistoryFactory.Create(
          { sponsor: campaign.guideName, userName, amount },
        );
        await transferHelper.recountDebtAfterTransfer(
          { guideName: campaign.guideName, amount: amount * 2, userName },
        );
        notPayedHistories = await Campaign.find({ payed: false }).lean();
      });
      it('should update all statuses to payed', async () => {
        expect(notPayedHistories).to.have.length(0);
      });
    });
    describe('status suspended and old debt', async () => {
      let updatedCampaign, newUser;
      beforeEach(async () => {
        newUser = faker.random.string();
        await PaymentHistoryFactory.Create({
          amount: 20, sponsor: campaign.guideName, userName: newUser, createdAt: moment.utc().subtract(40, 'day').toDate(),
        });
        await Campaign.updateOne({ _id: campaign._id }, { status: 'suspended' });
        await transferHelper.recountDebtAfterTransfer(
          { guideName: campaign.guideName, amount: 100, userName },
        );
        updatedCampaign = await Campaign.findOne({ _id: campaign._id }).lean();
      });
      it('should not change status if old debt exist', async () => {
        expect(updatedCampaign.status).to.be.eq('suspended');
      });
      it('should change status if old debt will be payed', async () => {
        await transferHelper.recountDebtAfterTransfer(
          { guideName: campaign.guideName, amount: 200, userName: newUser },
        );
        const result = await Campaign.findOne({ _id: campaign._id }).lean();
        expect(result.status).to.be.eq('active');
      });
    });
    describe('with old debt and amount < allowed', async () => {
      let updatedCampaign, newUser;
      beforeEach(async () => {
        newUser = faker.random.string();
        await PaymentHistoryFactory.Create({
          amount: 20, sponsor: campaign.guideName, userName: newUser, createdAt: moment.utc().subtract(40, 'day').toDate(),
        });
        await PaymentHistoryFactory.Create({
          amount: 19,
          sponsor: campaign.guideName,
          userName: newUser,
          type: 'transfer',
          remaining: 19,
        });
        await Campaign.updateOne({ _id: campaign._id }, { status: 'suspended' });
        await transferHelper.recountDebtAfterTransfer(
          { guideName: campaign.guideName, amount: 100, userName },
        );
        updatedCampaign = await Campaign.findOne({ _id: campaign._id }).lean();
      });
      it('should change status if old debt exist, and it smaller then min allowed', async () => {
        expect(updatedCampaign.status).to.be.eq('active');
      });
    });
    describe('with status reachLimit', async () => {
      let updatedCampaign;
      beforeEach(async () => {
        const users = [];
        for (let count = 0; count < 10; count++) {
          users.push({
            name: faker.random.string(),
            permlink: faker.random.string(),
            object_permlink: faker.random.string(),
            hiveCurrency: 1,
            app: 'waiviodev',
            status: 'completed',
          });
        }
        await Campaign.updateOne({ _id: campaign._id }, { users, status: 'suspended' });
        await transferHelper.recountDebtAfterTransfer(
          { guideName: campaign.guideName, amount: 100, userName },
        );
        updatedCampaign = await Campaign.findOne({ _id: campaign._id }).lean();
      });
      it('should change status from suspended to reachLimit', async () => {
        expect(updatedCampaign.status).to.be.eq('reachedLimit');
      });
    });
    describe('recount from old to new', async () => {
      let updatedPayments, oldPayment;
      beforeEach(async () => {
        await Campaign.updateOne({ _id: campaign._id }, {
          status: 'suspended',
        });
        oldPayment = await PaymentHistoryFactory.Create({
          amount: 15, userName, sponsor: campaign.guideName, createdAt: moment.utc().subtract(2, 'month').toDate(),
        });
        await transferHelper.recountDebtAfterTransfer(
          { guideName: campaign.guideName, amount: 15, userName },
        );
        updatedPayments = await PaymentHistory.find(
          { sponsor: campaign.guideName, userName },
        ).lean();
      });
      it('should update status old payment', async () => {
        const result = _.find(updatedPayments,
          (pmnt) => pmnt._id.toString() === oldPayment._id.toString());
        expect(result.payed).to.be.true;
      });
      it('should not change status if amount< payment', async () => {
        const result = _.find(updatedPayments,
          (pmnt) => pmnt._id.toString() === payment._id.toString());
        expect(result.payed).to.be.false;
      });
    });
    describe('with another transfers from guide to user', async () => {
      describe('if another transfer without remaining', async () => {
        let updatedPayments;
        beforeEach(async () => {
          await Campaign.updateOne({ _id: campaign._id }, { status: 'suspended' });
          await PaymentHistoryFactory.Create({
            type: 'transfer', sponsor: campaign.guideName, userName, payed: true,
          });
          await transferHelper.recountDebtAfterTransfer(
            { guideName: campaign.guideName, amount: amount - 0.5, userName },
          );
          updatedPayments = await PaymentHistory.findOne({ _id: payment._id }).lean();
        });
        it('should not change payment status if transfer < amount', async () => {
          expect(updatedPayments.payed).to.be.false;
        });
      });
      describe('with another payment with remaining', async () => {
        let oldPayment, transfer, payed, remaining;
        beforeEach(async () => {
          await Campaign.updateOne({ _id: campaign._id }, { status: 'suspended' });
          transfer = await PaymentHistoryFactory.Create({
            type: 'transfer', sponsor: campaign.guideName, userName, payed: false, remaining: 1.5,
          });
          oldPayment = await PaymentHistoryFactory.Create({
            amount: 1, userName, sponsor: campaign.guideName, createdAt: moment.utc().subtract(2, 'month').toDate(),
          });
          ({ payed, remaining } = await transferHelper.recountDebtAfterTransfer(
            { guideName: campaign.guideName, amount: amount + 0.5, userName },
          ));
          await PaymentHistory.findOne({ _id: payment._id }).lean();
        });
        it('should change status of another payment', async () => {
          const result = await PaymentHistory.findOne({ _id: transfer }).lean();
          expect(result.payed).to.be.true;
        });
        it('should change status of campaigns if old payment was payed', async () => {
          const result = await Campaign.findOne({ _id: campaign._id }).lean();
          expect(result.status).to.be.eq('active');
        });
        it('should set old payment payed to true', async () => {
          const result = await PaymentHistory.findOne({ _id: oldPayment._id }).lean();
          expect(result.payed).to.be.true;
        });
        it('should change payed of new payment to true', async () => {
          const result = await PaymentHistory.findOne({ _id: payment._id }).lean();
          expect(result.payed).to.be.true;
        });
        it('should return correct remaining', async () => {
          expect(remaining).to.be.eq(1);
        });
        it('should return correct payed status', async () => {
          expect(payed).to.be.false;
        });
      });
    });
  });
  describe('on checkOnHoldStatus', async () => {
    let campaign, permlink;
    describe('when there are users with status assigned', async () => {
      const users = [];
      beforeEach(async () => {
        permlink = faker.random.string();
        await dropDatabase();
        for (let i = 0; i < _.random(5, 10); i++) {
          users.push({
            status: i === 0 ? RESERVATION_STATUSES.ASSIGNED : _.sample(RESERVATION_STATUSES),
            name: `${faker.name.firstName()}${faker.random.number()}`,
            object_permlink: faker.random.string(),
            hiveCurrency: faker.random.number(),
            rewardRaisedBy: faker.random.number(),
            permlink: faker.random.string(),
          });
        }
        await CampaignFactory.Create({
          status: CAMPAIGN_STATUSES.ON_HOLD,
          activation_permlink: permlink,
          users,
        });
        await campaignHelper.checkOnHoldStatus(permlink);
        ({ result: campaign } = await campaignModel.findOne({ activation_permlink: permlink }));
      });
      it('should not change campaign status', async () => {
        expect(campaign.status).to.be.eq(CAMPAIGN_STATUSES.ON_HOLD);
      });
    });
    describe('when there is no users with assigned status', async () => {
      const users = [];
      beforeEach(async () => {
        permlink = faker.random.string();
        await dropDatabase();
        for (let i = 0; i < _.random(5, 10); i++) {
          users.push({
            status: _
              .sample(_.filter(RESERVATION_STATUSES, (s) => s !== RESERVATION_STATUSES.ASSIGNED)),
            name: `${faker.name.firstName()}${faker.random.number()}`,
            object_permlink: faker.random.string(),
            hiveCurrency: faker.random.number(),
            rewardRaisedBy: faker.random.number(),
            permlink: faker.random.string(),
          });
        }
        await CampaignFactory.Create({
          status: CAMPAIGN_STATUSES.ON_HOLD,
          activation_permlink: permlink,
          users,
        });
        await campaignHelper.checkOnHoldStatus(permlink);
        ({ result: campaign } = await campaignModel.findOne({ activation_permlink: permlink }));
      });
      it('should change campaign status to inactive', async () => {
        expect(campaign.status).to.be.eq(CAMPAIGN_STATUSES.INACTIVE);
      });
    });
    describe('when campaign status not onHold do nothing with status', async () => {
      let status;
      beforeEach(async () => {
        permlink = faker.random.string();
        status = _.sample(_.filter(CAMPAIGN_STATUSES, (s) => s !== CAMPAIGN_STATUSES.ON_HOLD));
        await dropDatabase();
        await CampaignFactory.Create({
          status,
          activation_permlink: permlink,
        });
        await campaignHelper.checkOnHoldStatus(permlink);
        ({ result: campaign } = await campaignModel.findOne({ activation_permlink: permlink }));
      });
      it('should not change campaign status', async () => {
        expect(campaign.status).to.be.eq(status);
      });
    });
  });
});
