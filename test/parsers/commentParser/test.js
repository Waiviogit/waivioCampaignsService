const moment = require('moment');
const { REFERRAL_TYPES } = require('constants/constants');
const { PAYMENT_HISTORIES_TYPES, RESERVATION_STATUSES } = require('constants/constants');
const {
  commentParser, paymentHistoryModel, paymentsHelper, dropDatabase, _,
  expect, ObjectID, redis, sinon, currencyRequest, Campaign, faker, redisSetter,
  BotUpvote, Constants, steemHelper, PaymentHistory, campaignActivation, reservationOps,
} = require('test/testHelper');
const {
  CampaignFactory, WobjectFactory, UserFactory,
  PaymentHistoryFactory, BotUpvoteFactory, MatchBotFactory,
} = require('test/factories');
const { campaignsForPayments } = require('test/mockData/campaigns');
const { getMocksData } = require('./mocks');

describe('comment Parser', async () => {
  beforeEach(async () => {
    sinon.stub(currencyRequest, 'getHiveCurrency').returns(Promise.resolve({ usdCurrency: 1 }));
  });
  afterEach(async () => {
    sinon.restore();
  });
  describe('parseRewards', async () => {
    const guideName = 'Guide';
    const demoUser = 'demo_user';
    let campaign, spy, campaignRequiredObject, assignObject;

    beforeEach(async () => {
      await dropDatabase();
      await UserFactory.Create({ name: guideName });
      campaignRequiredObject = await WobjectFactory.Create({ author_permlink: 'obj1' });
      assignObject = await WobjectFactory.Create({ author_permlink: 'assign_obj1' });
      campaign = await CampaignFactory.Create({
        status: 'active',
        objects: [assignObject.author_permlink],
        requiredObject: campaignRequiredObject.author_permlink,
        guideName,
        activation_permlink: Math.random().toString(36).substring(2, 15),
      });
    });

    afterEach(async () => {
      spy.restore();
    });

    describe('assignObject', async () => {
      let callback = null;

      beforeEach(async () => {
        spy = sinon.spy(reservationOps, 'assign');
        await UserFactory.Create({ name: demoUser });
      });

      it('should call assign with valid data', async () => {
        const metadata = {
          waivioRewards: {
            type: 'waivio_assign_campaign',
            approved_object: assignObject.author_permlink,
          },
        };
        const { operation } = await getMocksData({
          parent_permlink: campaign.activation_permlink,
          permlink: assignObject.permlink,
          author: guideName,
          metadata: JSON.stringify(metadata),
        });

        await commentParser.parse(operation);
        await Promise.resolve(spy.returnValues[0])
          .then((data) => {
            callback = data.result;
          });
        expect(callback).to.be.true;
        expect(spy.calledOnce).to.be.true;
      });

      it('should call assign with valid data and referral acc', async () => {
        const metadata = {
          waivioRewards: {
            type: 'waivio_assign_campaign',
            approved_object: assignObject.author_permlink,
          },
          app: 'referral_acc',
        };
        const { operation } = await getMocksData({
          parent_permlink: campaign.activation_permlink,
          permlink: assignObject.permlink,
          author: guideName,
          metadata: JSON.stringify(metadata),
        });

        await commentParser.parse(operation);
        const updated_campaign = await Campaign.findOne({ _id: campaign._id });

        expect(updated_campaign.users[1].referral_server).to.be.eq('referral_acc');
      });

      it('should call assign with demo user', async () => {
        const metadata = {
          waivioRewards: {
            type: 'waivio_assign_campaign',
            approved_object: assignObject.author_permlink,
          },
          comment: { userId: demoUser },
        };
        const { operation } = await getMocksData({
          parent_permlink: campaign.activation_permlink,
          permlink: assignObject.permlink,
          author: guideName,
          metadata: JSON.stringify(metadata),
        });

        await commentParser.parse(operation);
        await Promise.resolve(spy.returnValues[0])
          .then((data) => {
            callback = data.result;
          });
        expect(callback).to.be.true;
        expect(spy.calledOnce).to.be.true;
        expect(spy.args[0][0].user_name).to.be.eq(demoUser);
      });

      it('should call assign with not exist demo user', async () => {
        const metadata = {
          waivioRewards: {
            type: 'waivio_assign_campaign',
            approved_object: assignObject.author_permlink,
          },
          comment: { userId: 'aaaa' },
        };
        const { operation } = await getMocksData({
          parent_permlink: campaign.activation_permlink,
          permlink: assignObject.permlink,
          author: guideName,
          metadata: JSON.stringify(metadata),
        });

        await commentParser.parse(operation);
        await Promise.resolve(spy.returnValues[0])
          .then((data) => {
            callback = data.result;
          });
        expect(callback).to.be.false;
        expect(spy.calledOnce).to.be.true;
      });

      it('should call assign with metadata with comment key, but without user id', async () => {
        const metadata = {
          waivioRewards: {
            type: 'waivio_assign_campaign',
            approved_object: assignObject.author_permlink,
          },
          comment: {},
        };
        const { operation } = await getMocksData({
          parent_permlink: campaign.activation_permlink,
          permlink: assignObject.permlink,
          author: guideName,
          metadata: JSON.stringify(metadata),
        });

        await commentParser.parse(operation);
        await Promise.resolve(spy.returnValues[0])
          .then((data) => {
            callback = data.result;
          });
        expect(callback).to.be.true;
        expect(spy.calledOnce).to.be.true;
        expect(spy.args[0][0].user_name).to.be.eq(guideName);
      });

      it('should call assign without approved_object', async () => {
        const metadata = { waivioRewards: { type: 'waivio_assign_campaign' } };
        const { operation } = await getMocksData({
          parent_permlink: campaign.activation_permlink,
          permlink: assignObject.permlink,
          author: guideName,
          metadata: JSON.stringify(metadata),
        });

        await commentParser.parse(operation);
        await Promise.resolve(spy.returnValues[0])
          .then((data) => {
            callback = data.result;
          });
        expect(callback).to.be.false;
        expect(spy.calledOnce).to.be.true;
      });

      it('should call assign without campaign permlink', async () => {
        const metadata = {
          waivioRewards: {
            type: 'waivio_assign_campaign',
            approved_object: assignObject.author_permlink,
          },
        };
        const { operation } = await getMocksData({
          parent_permlink: null,
          permlink: assignObject.permlink,
          author: guideName,
          metadata: JSON.stringify(metadata),
        });

        await commentParser.parse(operation);
        await Promise.resolve(spy.returnValues[0])
          .then((data) => {
            callback = data.result;
          });
        expect(callback).to.be.false;
        expect(spy.calledOnce).to.be.true;
      });

      it('should call assign with invalid author', async () => {
        const metadata = {
          waivioRewards: {
            type: 'waivio_assign_campaign',
            approved_object: assignObject.author_permlink,
          },
        };
        const { operation } = await getMocksData({
          parent_permlink: campaign.activation_permlink,
          permlink: assignObject.permlink,
          author: 'jgf',
          metadata: JSON.stringify(metadata),
        });

        await commentParser.parse(operation);
        await Promise.resolve(spy.returnValues[0])
          .then((data) => {
            callback = data.result;
          });
        expect(callback).to.be.false;
        expect(spy.calledOnce).to.be.true;
      });

      it('should call assign with invalid approvedObject', async () => {
        const metadata = { waivioRewards: { type: 'waivio_assign_campaign', approved_object: guideName } };
        const { operation } = await getMocksData({
          parent_permlink: campaign.activation_permlink,
          permlink: assignObject.permlink,
          author: guideName,
          metadata: JSON.stringify(metadata),
        });

        await commentParser.parse(operation);
        await Promise.resolve(spy.returnValues[0])
          .then((data) => {
            callback = data.result;
          });
        expect(callback).to.be.false;
        expect(spy.calledOnce).to.be.true;
      });

      it('should not call assignObject with invalid type', async () => {
        const metadata = { waivioRewards: { type: 'invalid_type', approved_object: assignObject.author_permlink } };
        const { operation } = await getMocksData({
          parent_permlink: campaign.activation_permlink,
          permlink: assignObject.permlink,
          author: guideName,
          metadata: JSON.stringify(metadata),
        });

        await commentParser.parse(operation);
        expect(spy.callCount).to.be.eq(0);
      });

      it('should not call assignObject without key waivioRewards', async () => {
        const metadata = {
          some_key: {
            type: 'waivio_assign_campaign',
            approved_object: assignObject.author_permlink,
          },
        };
        const { operation } = await getMocksData({
          parent_permlink: campaign.activation_permlink,
          permlink: assignObject.permlink,
          author: guideName,
          metadata: JSON.stringify(metadata),
        });

        await commentParser.parse(operation);
        expect(spy.callCount).to.be.eq(0);
      });
    });
    describe('rejectObject', async () => {
      let callback = null;

      beforeEach(async () => {
        await dropDatabase();
        await UserFactory.Create({ name: demoUser });
        campaignRequiredObject = await WobjectFactory.Create({ author_permlink: 'obj1' });
        assignObject = await WobjectFactory.Create({ author_permlink: 'assign_obj1' });
        spy = sinon.spy(reservationOps, 'reject');
        campaign = await CampaignFactory.Create({
          status: 'active',
          users: [
            {
              name: guideName,
              object_permlink: 'assign_obj1',
              permlink: 'permlink1',
              hiveCurrency: 1,
            },
            {
              name: demoUser,
              object_permlink: 'assign_obj2',
              permlink: 'permlink2',
              hiveCurrency: 1,
            },
          ],
          objects: [assignObject.author_permlink],
          requiredObject: campaignRequiredObject.author_permlink,
          guideName,
          activation_permlink: Math.random().toString(36).substring(2, 15),
        });
      });
      it('should call rejectObject with valid data', async () => {
        const metadata = {
          waivioRewards: {
            type: 'waivio_reject_object_campaign',
            reservation_permlink: 'permlink1',
          },
        };
        const { operation } = await getMocksData({
          parent_permlink: campaign.activation_permlink,
          permlink: 'some_unreservation_permlink',
          author: guideName,
          metadata: JSON.stringify(metadata),
        });

        await commentParser.parse(operation);
        await Promise.resolve(spy.returnValues[0])
          .then((data) => {
            callback = data.result;
          });
        expect(callback).to.be.true;
        expect(spy.calledOnce).to.be.true;
      });

      it('should call rejectObject with demo user', async () => {
        const metadata = {
          waivioRewards: { type: 'waivio_reject_object_campaign', reservation_permlink: 'permlink2' },
          comment: { userId: demoUser },
        };
        const { operation } = await getMocksData({
          parent_permlink: campaign.activation_permlink,
          permlink: 'some_unreservation_permlink',
          author: guideName,
          metadata: JSON.stringify(metadata),
        });

        await commentParser.parse(operation);
        await Promise.resolve(spy.returnValues[0])
          .then((data) => {
            callback = data.result;
          });
        expect(callback).to.be.true;
        expect(spy.calledOnce).to.be.true;
        expect(spy.args[0][0].user_name).to.be.eq(demoUser);
      });

      it('should call rejectObject with not exist demo user', async () => {
        const metadata = {
          waivioRewards: { type: 'waivio_reject_object_campaign', reservation_permlink: 'permlink2' },
          comment: { userId: 'aa' },
        };
        const { operation } = await getMocksData({
          parent_permlink: campaign.activation_permlink,
          permlink: 'some_unreservation_permlink',
          author: guideName,
          metadata: JSON.stringify(metadata),
        });

        await commentParser.parse(operation);
        await Promise.resolve(spy.returnValues[0])
          .then((data) => {
            callback = data.result;
          });
        expect(callback).to.be.false;
      });

      it('should call rejectObject with metadata comment key and without userId', async () => {
        const metadata = {
          waivioRewards: { type: 'waivio_reject_object_campaign', reservation_permlink: 'permlink1' },
          comment: {},
        };
        const { operation } = await getMocksData({
          parent_permlink: campaign.activation_permlink,
          permlink: 'some_unreservation_permlink',
          author: guideName,
          metadata: JSON.stringify(metadata),
        });

        await commentParser.parse(operation);
        await Promise.resolve(spy.returnValues[0])
          .then((data) => {
            callback = data.result;
          });
        expect(callback).to.be.true;
        expect(spy.calledOnce).to.be.true;
        expect(spy.args[0][0].user_name).to.be.eq(guideName);
      });

      it('should call rejectObject with invalid user', async () => {
        const metadata = {
          waivioRewards: {
            type: 'waivio_reject_object_campaign',
            reservation_permlink: 'permlink1',
          },
        };
        const { operation } = await getMocksData({
          parent_permlink: campaign.activation_permlink,
          permlink: assignObject.permlink,
          author: 'jugf',
          metadata: JSON.stringify(metadata),
        });

        await commentParser.parse(operation);
        await Promise.resolve(spy.returnValues[0])
          .then((data) => {
            callback = data.result;
          });
        expect(callback).to.be.false;
        expect(spy.calledOnce).to.be.true;
      });

      it('should call rejectObject with invalid campaign permlink', async () => {
        const metadata = {
          waivioRewards: {
            type: 'waivio_reject_object_campaign',
            reservation_permlink: 'permlink1',
          },
        };
        const { operation } = await getMocksData({
          parent_permlink: 'asda',
          permlink: assignObject.permlink,
          author: guideName,
          metadata: JSON.stringify(metadata),
        });

        await commentParser.parse(operation);
        await Promise.resolve(spy.returnValues[0])
          .then((data) => {
            callback = data.result;
          });
        expect(callback).to.be.false;
        expect(spy.calledOnce).to.be.true;
      });

      it('should call rejectObject with invalid assign permlink', async () => {
        const metadata = {
          waivioRewards: {
            type: 'waivio_reject_object_campaign',
            reservation_permlink: 'asdasd',
          },
        };
        const { operation } = await getMocksData({
          parent_permlink: campaign.activation_permlink,
          permlink: assignObject.permlink,
          author: guideName,
          metadata: JSON.stringify(metadata),
        });

        await commentParser.parse(operation);
        await Promise.resolve(spy.returnValues[0])
          .then((data) => {
            callback = data.result;
          });
        expect(callback).to.be.false;
        expect(spy.calledOnce).to.be.true;
      });

      it('should not call rejectObject with invalid type', async () => {
        const metadata = { waivioRewards: { type: 'invalid_type', approved_object: assignObject.author_permlink } };
        const { operation } = await getMocksData({
          parent_permlink: campaign.activation_permlink,
          permlink: assignObject.permlink,
          author: guideName,
          metadata: JSON.stringify(metadata),
        });

        await commentParser.parse(operation);
        expect(spy.callCount).to.be.eq(0);
      });

      it('should not call rejectObject without key waivioRewards', async () => {
        const metadata = {
          some_key: {
            type: 'waivio_reject_object_campaign',
            approved_object: assignObject.author_permlink,
          },
        };
        const { operation } = await getMocksData({
          parent_permlink: campaign.activation_permlink,
          permlink: assignObject.permlink,
          author: guideName,
          metadata: JSON.stringify(metadata),
        });

        await commentParser.parse(operation);
        expect(spy.callCount).to.be.eq(0);
      });
    });
    describe('activate campaign', async () => {
      let callback = null;

      beforeEach(async () => {
        spy = sinon.spy(campaignActivation, 'activate');
        campaign = await CampaignFactory.Create({
          budget: 2,
          reward: 1,
          guideName: 'eugenezh',
          status: 'pending',
          objects: [assignObject.author_permlink],
          requiredObject: campaignRequiredObject.author_permlink,
        });
      });
      it('should call activate campaign with valid data', async () => {
        const metadata = { waivioRewards: { type: 'waivio_activate_campaign', campaign_id: campaign._id } };
        const { operation } = await getMocksData({
          parent_permlink: campaign.activation_permlink,
          author: 'eugenezh',
          metadata: JSON.stringify(metadata),
        });

        await commentParser.parse(operation);
        await Promise.resolve(spy.returnValues[0])
          .then((data) => {
            callback = data.result;
          });
        expect(callback).to.be.true;
        expect(spy.calledOnce).to.be.true;
      });

      it('should call activate campaign with invalid author', async () => {
        const metadata = { waivioRewards: { type: 'waivio_activate_campaign', campaign_id: campaign._id } };
        const { operation } = await getMocksData({
          parent_permlink: campaign.activation_permlink,
          author: 'aaa',
          metadata: JSON.stringify(metadata),
        });

        await commentParser.parse(operation);
        await Promise.resolve(spy.returnValues[0])
          .then((data) => {
            callback = data.result;
          });
        expect(callback).to.be.false;
        expect(spy.calledOnce).to.be.true;
      });

      it('should call activate campaign with invalid campaign id', async () => {
        const metadata = { waivioRewards: { type: 'waivio_activate_campaign', campaign_id: assignObject._id } };
        const { operation } = await getMocksData({
          parent_permlink: campaign.activation_permlink,
          author: 'eugenezh',
          metadata: JSON.stringify(metadata),
        });

        await commentParser.parse(operation);
        await Promise.resolve(spy.returnValues[0])
          .then((data) => {
            callback = data.result;
          });
        expect(callback).to.be.false;
        expect(spy.calledOnce).to.be.true;
      });

      it('should call activate campaign with active campaign', async () => {
        campaign = await CampaignFactory.Create({
          budget: 2,
          reward: 1,
          guideName: 'eugenezh',
          status: 'active',
          objects: [assignObject.author_permlink],
          requiredObject: campaignRequiredObject.author_permlink,
          activation_permlink: Math.random().toString(36).substring(2, 15),
        });
        const metadata = { waivioRewards: { type: 'waivio_activate_campaign', campaign_id: campaign._id } };
        const { operation } = await getMocksData({
          parent_permlink: campaign.activation_permlink,
          author: 'eugenezh',
          metadata: JSON.stringify(metadata),
        });

        await commentParser.parse(operation);
        await Promise.resolve(spy.returnValues[0])
          .then((data) => {
            callback = data.result;
          });
        expect(callback).to.be.false;
        expect(spy.calledOnce).to.be.true;
      });

      it('should not call activate campaign with invalid type', async () => {
        const metadata = { waivioRewards: { type: 'sdfzdsh', campaign_id: campaign._id } };
        const { operation } = await getMocksData({
          parent_permlink: campaign.activation_permlink,
          author: 'eugenezh',
          metadata: JSON.stringify(metadata),
        });

        await commentParser.parse(operation);
        expect(spy.callCount).to.be.eq(0);
      });

      it('should not call activate campaign without key waivioRewards', async () => {
        const metadata = { dsafxd: { type: 'waivio_activate_campaign', campaign_id: campaign._id } };
        const { operation } = await getMocksData({
          parent_permlink: campaign.activation_permlink,
          author: 'eugenezh',
          metadata: JSON.stringify(metadata),
        });

        await commentParser.parse(operation);
        expect(spy.callCount).to.be.eq(0);
      });
    });
    describe('deactivate campaign', async () => {
      let callback = null;

      beforeEach(async () => {
        spy = sinon.spy(campaignActivation, 'inactivate');
        campaign = await CampaignFactory.Create({
          budget: 2,
          reward: 1,
          guideName: 'eugenezh',
          status: 'active',
          objects: [assignObject.author_permlink],
          requiredObject: campaignRequiredObject.author_permlink,
          activation_permlink: Math.random().toString(36).substring(2, 15),
        });
      });
      it('should call deactivate campaign with valid data', async () => {
        const metadata = { waivioRewards: { type: 'waivio_stop_campaign' } };
        const { operation } = await getMocksData({
          parent_permlink: campaign.activation_permlink,
          author: 'eugenezh',
          metadata: JSON.stringify(metadata),
        });

        await commentParser.parse(operation);
        await Promise.resolve(spy.returnValues[0])
          .then((data) => {
            callback = data.result;
          });
        expect(callback).to.be.true;
        expect(spy.calledOnce).to.be.true;
      });

      it('should call deactivate campaign with invalid author', async () => {
        const metadata = { waivioRewards: { type: 'waivio_stop_campaign' } };
        const { operation } = await getMocksData({
          parent_permlink: campaign.activation_permlink,
          author: 'aaa',
          metadata: JSON.stringify(metadata),
        });

        await commentParser.parse(operation);
        await Promise.resolve(spy.returnValues[0])
          .then((data) => {
            callback = data.result;
          });
        expect(callback).to.be.false;
        expect(spy.calledOnce).to.be.true;
      });

      it('should call deactivate campaign with invalid activation permlink', async () => {
        const metadata = { waivioRewards: { type: 'waivio_stop_campaign' } };
        const { operation } = await getMocksData({
          parent_permlink: 'yhjufh',
          author: 'eugenezh',
          metadata: JSON.stringify(metadata),
        });

        await commentParser.parse(operation);
        await Promise.resolve(spy.returnValues[0])
          .then((data) => {
            callback = data.result;
          });
        expect(callback).to.be.false;
        expect(spy.calledOnce).to.be.true;
      });

      it('should call deactivate campaign with payed campaign', async () => {
        campaign = await CampaignFactory.Create({
          budget: 2,
          reward: 1,
          guideName: 'eugenezh',
          status: 'payed',
          objects: [assignObject.author_permlink],
          requiredObject: campaignRequiredObject.author_permlink,
          activation_permlink: Math.random().toString(36).substring(2, 15),
          deactivation_permlink: 'inactive_permlink',
        });
        const metadata = { waivioRewards: { type: 'waivio_stop_campaign' } };
        const { operation } = await getMocksData({
          parent_permlink: campaign.activation_permlink,
          author: 'eugenezh',
          metadata: JSON.stringify(metadata),
        });

        await commentParser.parse(operation);
        await Promise.resolve(spy.returnValues[0])
          .then((data) => {
            callback = data.result;
          });
        expect(callback).to.be.false;
        expect(spy.calledOnce).to.be.true;
      });

      it('should not call deactivate campaign with invalid type', async () => {
        const metadata = { waivioRewards: { type: 'sdfzdsh' } };
        const { operation } = await getMocksData({
          parent_permlink: campaign.activation_permlink,
          author: 'eugenezh',
          metadata: JSON.stringify(metadata),
        });

        await commentParser.parse(operation);
        expect(spy.callCount).to.be.eq(0);
      });

      it('should not call deactivate campaign without key waivioRewards', async () => {
        const metadata = { dsafxd: { type: 'waivio_activate_campaign' } };
        const { operation } = await getMocksData({
          parent_permlink: campaign.activation_permlink,
          author: 'eugenezh',
          metadata: JSON.stringify(metadata),
        });

        await commentParser.parse(operation);
        expect(spy.callCount).to.be.eq(0);
      });
    });
  });
  describe('parsePayments', async () => {
    let spy, objects = ['obj1', 'obj2', 'obj3'];

    beforeEach(async () => {
      await dropDatabase();
      for (let i = 0; i < 3; i++) {
        const user = {
          status: 'assigned', name: `user${i + 1}`, object_permlink: objects[i % 3], permlink: 'permlink', hiveCurrency: 1,
        };
        await CampaignFactory.Create({
          status: 'active', users: [user], objects, permlink: `permlink${i + 1}`,
        });
      }
      await CampaignFactory.Create({
        status: 'active',
        users: [{
          status: 'assigned', name: 'user2', object_permlink: objects[0], permlink: 'permlink', hiveCurrency: 1,
        }],
        objects,
        permlink: 'permlink4',
        match_bots: ['guest123'],
      });

      await campaignsForPayments(objects);

      await CampaignFactory.Create({
        status: 'active',
        users: [{
          status: 'assigned', name: 'user1', object_permlink: objects[0], permlink: 'permlink', hiveCurrency: 1,
        }, {
          status: 'assigned', name: 'user2', object_permlink: objects[0], permlink: 'permlink', hiveCurrency: 1,
        }, {
          status: 'assigned', name: 'demoUser', object_permlink: objects[0], permlink: 'permlink', hiveCurrency: 1,
        },
        ],
        objects,
        permlink: 'permlink9',
      });
      const _id = new ObjectID();
      await CampaignFactory.Create({
        status: 'active',
        users: [{
          _id, status: 'completed', name: 'user3', object_permlink: objects[2], permlink: 'permlink', hiveCurrency: 1,
        }, {
          status: 'assigned', name: 'user3', object_permlink: objects[2], permlink: 'permlink', hiveCurrency: 1,
        },
        ],
        payments: [{
          reservationId: _id,
          campaignUserId: new ObjectID(),
          userName: 'user3',
          rootAuthor: 'user3',
          objectPermlink: 'obj3',
          postTitle: 'title',
          postPermlink: 'postPermink',
          status: 'active',
        }],
        objects,
        permlink: 'permlink9',
      });
      await CampaignFactory.Create({
        status: 'active',
        users: [{
          status: 'assigned', name: 'user2', object_permlink: objects[0], permlink: 'permlink', hiveCurrency: 1,
        }],
        payments: [{
          reservationId: new ObjectID(),
          rootAuthor: 'user2',
          userName: 'user2',
          objectPermlink: 'obj1',
          postTitle: 'title',
          postPermlink: 'postPermink',
        }],
        objects,
        permlink: 'permlink10',
      });
    });

    afterEach(async () => {
      spy.restore();
    });

    describe('createReview', async () => {
      beforeEach(() => {
        spy = sinon.spy(paymentsHelper, 'createReview');
      });

      it('should call create review with valid data', async () => {
        const metadata = { wobj: { wobjects: [{ author_permlink: 'obj1' }] }, app: 'app' };
        const { operation } = await getMocksData({ author: 'user1', metadata: JSON.stringify(metadata) });

        await commentParser.parse(operation);
        expect(spy.callCount).to.be.eq(1);
      });

      it('should create correct referral debt', async () => {
        const agent = faker.random.string();
        await UserFactory.Create({
          followers_count: 10,
          count_posts: 10,
          name: 'user1',
          referral: {
            type: REFERRAL_TYPES.REVIEWS,
            endedAt: moment.utc().add(10, 'days').toDate(),
            agent,
          },
        });
        const metadata = { wobj: { wobjects: [{ author_permlink: 'obj1' }] }, app: 'app', image: [faker.random.string()] };
        const { operation } = await getMocksData({ author: 'user1', metadata: JSON.stringify(metadata) });
        await commentParser.parse(operation);
        const result = await PaymentHistory.findOne(
          { type: PAYMENT_HISTORIES_TYPES.REFERRAL_SERVER_FEE, userName: agent },
        );
        expect(result).to.be.exist;
      });

      it('should call create review with bot comment', async () => {
        const metadata = {
          wobj: { wobjects: [{ author_permlink: 'obj1' }] },
          comment: { userId: 'demoUser' },
          app: 'app',
        };
        const { operation } = await getMocksData({ author: 'user1', metadata: JSON.stringify(metadata) });
        await commentParser.parse(operation);

        expect(spy.callCount).to.be.eq(1);
        expect(spy.args[0][0].owner_account).to.be.eq('user1');
      });

      it('should call create review with many wobjects', async () => {
        const metadata = {
          wobj: { wobjects: [{ author_permlink: 'obj1' }, { author_permlink: 'obj2' }, { author_permlink: 'obj3' }] },
          app: 'app',
        };
        const { operation } = await getMocksData({ author: 'user1', metadata: JSON.stringify(metadata) });

        await commentParser.parse(operation);
        expect(spy.callCount).to.be.eq(1);
      });

      it('should call create review with invalid user name', async () => {
        const metadata = { wobj: { wobjects: [{ author_permlink: 'obj1' }] }, app: 'app' };
        const { operation } = await getMocksData({ metadata: JSON.stringify(metadata) });
        await commentParser.parse(operation);
        expect(spy.callCount).to.be.eq(0);
      });

      it('should not call create review without author permlinks', async () => {
        const metadata = { wobj: { wobjects: [] }, app: 'app' };
        const { operation } = await getMocksData({ metadata: JSON.stringify(metadata) });
        await commentParser.parse(operation);
        expect(spy.callCount).to.be.eq(0);
      });

      it('should not call create review without wobjects', async () => {
        const metadata = { wobj: {}, app: 'app' };
        const { operation } = await getMocksData({ metadata: JSON.stringify(metadata) });
        await commentParser.parse(operation);
        expect(spy.callCount).to.be.eq(0);
      });

      it('should not call create review without wobj', async () => {
        const metadata = { app: 'app' };
        const { operation } = await getMocksData({ metadata: JSON.stringify(metadata) });
        await commentParser.parse(operation);
        expect(spy.callCount).to.be.eq(0);
      });
    });
    describe('createPaymentHistory', async () => {
      beforeEach(async () => {
        await UserFactory.Create({ name: 'user1', count_posts: 100, followers_count: 100 });
        spy = sinon.spy(paymentHistoryModel, 'addPaymentHistory');
      });

      it('should call addPaymentHistory with valid data', async () => {
        const metadata = { wobj: { wobjects: [{ author_permlink: 'obj1' }] }, image: [faker.random.string()], app: 'app' };
        const { operation } = await getMocksData({
          parent_permlink: 'permlink',
          permlink: 'permlink',
          title: 'title',
          author: 'user1',
          metadata: JSON.stringify(metadata),
        });

        await commentParser.parse(operation);
        expect(spy.callCount).to.be.eq(8);
      });

      it('should call addPaymentHistory with valid data and referral account', async () => {
        const metadata = { wobj: { wobjects: [{ author_permlink: 'obj1' }] }, image: [faker.random.string()], app: 'app' };
        const { operation } = await getMocksData({
          parent_permlink: 'permlink',
          permlink: 'permlink',
          title: 'title',
          author: 'user1',
          metadata: JSON.stringify(metadata),
        });

        await commentParser.parse(operation);
        expect(spy.callCount).to.be.eq(8);
      });

      it('should call addPaymentHistory with many wobjects', async () => {
        const metadata = {
          wobj: { wobjects: [{ author_permlink: 'obj1' }, { author_permlink: 'obj2' }, { author_permlink: 'obj3' }] },
          app: 'app',
          image: [faker.random.string()],
        };
        const { operation } = await getMocksData({
          parent_permlink: 'permlink',
          permlink: 'permlink',
          title: 'title',
          author: 'user1',
          metadata: JSON.stringify(metadata),
        });
        await commentParser.parse(operation);
        expect(spy.callCount).to.be.eq(8);
      });

      it('should call addPaymentHistory with invalid user name', async () => {
        const metadata = { wobj: { wobjects: [{ author_permlink: 'obj1' }] }, app: 'app', image: [faker.random.string()] };
        const { operation } = await getMocksData({
          parent_permlink: 'permlink',
          permlink: 'permlink',
          title: 'title',
          author: 'aaa',
          metadata: JSON.stringify(metadata),
        });

        await commentParser.parse(operation);
        expect(spy.calledOnce).to.be.false;
      });

      it('should call addPaymentHistory without author permlinks', async () => {
        const metadata = { wobj: { wobjects: [] }, app: 'app' };
        const { operation } = await getMocksData({
          parent_permlink: 'permlink',
          permlink: 'permlink',
          title: 'title',
          author: 'aaa',
          metadata: JSON.stringify(metadata),
        });

        await commentParser.parse(operation);
        expect(spy.calledOnce).to.be.false;
      });

      it('should call addPaymentHistory without wobjects', async () => {
        const metadata = { wobj: {}, app: 'app' };
        const { operation } = await getMocksData({
          parent_permlink: 'permlink',
          permlink: 'permlink',
          title: 'title',
          author: 'aaa',
          metadata: JSON.stringify(metadata),
        });

        await commentParser.parse(operation);
        expect(spy.calledOnce).to.be.false;
      });

      it('should call addPaymentHistory without wobj', async () => {
        const metadata = { app: 'app' };
        const { operation } = await getMocksData({
          parent_permlink: 'permlink',
          permlink: 'permlink',
          title: 'title',
          author: 'aaa',
          metadata: JSON.stringify(metadata),
        });

        await commentParser.parse(operation);
        expect(spy.calledOnce).to.be.false;
      });
    });
  });
  describe('parseDemoPosts', async () => {
    let spy;
    beforeEach(async () => {
      await dropDatabase();
      spy = sinon.spy(redisSetter, 'setDemoPost');
    });
    afterEach(async () => {
      spy.restore();
    });

    it('should be written demo post to redis', async () => {
      const metadata = { comment: { userId: '' } };
      const { operation } = await getMocksData({
        parent_permlink: 'permlink',
        permlink: 'permlink',
        title: 'title',
        author: 'author',
        parent_author: '',
        metadata: JSON.stringify(metadata),
      });
      await commentParser.parse(operation);
      const records = await redis.demoPosts.keysAsync('expire:demopost*');
      expect(spy.callCount).to.be.eq(1);
      expect(records.length).to.be.eq(1);
    });

    it('should be not written demo post to redis without userId key', async () => {
      const metadata = { comment: { bla: '' } };
      const { operation } = await getMocksData({
        parent_permlink: 'permlink',
        permlink: 'permlink',
        title: 'title',
        author: 'author',
        parent_author: '',
        metadata: JSON.stringify(metadata),
      });
      await commentParser.parse(operation);
      expect(spy.callCount).to.be.eq(0);
    });

    it('should be not written demo post to redis without comment key', async () => {
      const metadata = { bla: { userId: '' } };
      const { operation } = await getMocksData({
        parent_permlink: 'permlink',
        permlink: 'permlink',
        title: 'title',
        author: 'author',
        parent_author: '',
        metadata: JSON.stringify(metadata),
      });
      await commentParser.parse(operation);
      expect(spy.callCount).to.be.eq(0);
    });

    it('should be not written demo post to redis with parent author comment key', async () => {
      const metadata = { bla: { userId: '' } };
      const { operation } = await getMocksData({
        parent_permlink: 'permlink',
        permlink: 'permlink',
        title: 'title',
        author: 'author',
        parent_author: 'parent_author',
        metadata: JSON.stringify(metadata),
      });
      await commentParser.parse(operation);
      expect(spy.callCount).to.be.eq(0);
    });
  });
});

describe('parseRejectReservationByGuide', async () => {
  let guide, user, reservationPermlink, beneficiaries, comment, wobject, campaign, reviewPermlink;
  beforeEach(async () => {
    await dropDatabase();
    guide = await UserFactory.Create();
    user = await UserFactory.Create();
    wobject = await WobjectFactory.Create();
    beneficiaries = [{ account: faker.name.firstName(), weight: 1000 }];
    reservationPermlink = faker.random.string();
    reviewPermlink = faker.random.string();
    const types = ['review', 'beneficiary_fee', 'campaign_server_fee', 'index_fee', 'referral_server_fee'];
    for (const type of types) {
      await PaymentHistoryFactory.Create({
        type,
        permlink: reservationPermlink,
        sponsor: guide.name,
        userName: type === 'review' ? user.name : beneficiaries[0].account,
        beneficiaries,
        reviewPermlink,
      });
    }
    const _id = new ObjectID();
    campaign = await CampaignFactory.Create({
      guideName: guide.name,
      users: [{
        _id,
        status: 'completed',
        name: user.name,
        permlink: reservationPermlink,
        object_permlink: wobject.author_permlink,
        hiveCurrency: 1,
      }],
      payments: [{
        reservationId: _id,
        status: 'active',
        rootAuthor: user.name,
        userName: user.name,
        postTitle: faker.random.string(10),
        postPermlink: reviewPermlink,
        objectPermlink: wobject.author_permlink,
      }],
    });
    comment = (await getMocksData({
      parent_author: user.name,
      author: guide.name,
      parent_permlink: reservationPermlink,
      metadata: JSON.stringify({ waivioRewards: { type: 'reject_reservation_by_guide' } }),
    })).operation;
  });
  afterEach(async () => {
    sinon.restore();
  });
  describe('without upvote bot with status completed', async () => {
    let updatedCampaign, histories;
    beforeEach(async () => {
      sinon.stub(steemHelper, 'getPostInfo').returns(Promise.resolve({
        created: moment.utc().subtract(2, 'day').toString(),
      }));
      await commentParser.parse(comment);
      updatedCampaign = await Campaign.findOne({ _id: campaign._id }).lean();
      ({ result: histories } = await paymentHistoryModel.find(
        { 'details.reservation_permlink': reservationPermlink },
      ));
    });
    it('should delete all payment histories', async () => {
      expect(histories).to.have.length(0);
    });
    it('should update user status to rejected', async () => {
      const updatedUser = _.find(updatedCampaign.users, (member) => member.name === user.name);
      expect(updatedUser.status).to.be.eq('rejected');
    });
    it('should add rejection permlink to user', async () => {
      const updatedUser = _.find(updatedCampaign.users, (member) => member.name === user.name);
      expect(updatedUser.rejection_permlink).to.be.eq(comment.permlink);
    });
    it('should add rejection permlink to payment', async () => {
      const updatedPayment = _.find(updatedCampaign.payments,
        (member) => member.userName === user.name);
      expect(updatedPayment.rejectionPermlink).to.be.eq(comment.permlink);
    });
    it('should update payment status to rejected ', async () => {
      const updatedPayment = _.find(updatedCampaign.payments,
        (member) => member.userName === user.name);
      expect(updatedPayment.status).to.be.eq('rejected');
    });
  });

  describe('without upvote bot with status assigned', async () => {
    let updatedCampaign;
    beforeEach(async () => {
      await Campaign.updateOne({ _id: campaign._id }, { $set: { payments: {}, 'users.$[].status': 'assigned' } });
      await commentParser.parse(comment);
      updatedCampaign = await Campaign.findOne({ _id: campaign._id }).lean();
    });
    it('should add rejection permlink to user', async () => {
      const updatedUser = _.find(updatedCampaign.users, (member) => member.name === user.name);
      expect(updatedUser.rejection_permlink).to.be.eq(comment.permlink);
    });
    it('should update user status to rejected', async () => {
      const updatedUser = _.find(updatedCampaign.users, (member) => member.name === user.name);
      expect(updatedUser.status).to.be.eq('rejected');
    });
  });

  describe('with upvote bot, and not expired vote', async () => {
    let matchBot;
    beforeEach(async () => {
      sinon.stub(steemHelper, 'likePost').returns(Promise.resolve({ result: true }));
      sinon.stub(steemHelper, 'getPostInfo').returns(Promise.resolve({
        created: moment.utc().subtract(2, 'day').toString(),
        author: user.name,
      }));
      matchBot = await MatchBotFactory.Create({});
      await BotUpvoteFactory.Create({
        bot_name: matchBot.bot_name,
        author: user.name,
        permlink: reviewPermlink,
        status: 'upvoted',
        createdAt: moment.utc().subtract(2, 'day'),
        currentVote: 1,
      });
    });
    describe('with one match bot, and not expired vote', async () => {
      beforeEach(async () => {
        await PaymentHistory.updateOne({ type: 'review', userName: user.name }, { 'details.votesAmount': 0.9 });
        await PaymentHistory.updateOne({ type: 'beneficiary_fee', userName: beneficiaries[0].account }, { 'details.votesAmount': 0.1 });
      });
      describe('On success', async () => {
        let histories;
        beforeEach(async () => {
          sinon.stub(steemHelper, 'getAccountsInfo').returns(Promise.resolve([{ posting: { account_auths: [[Constants.upvoteBot.userName, 1]] } }]));
          await commentParser.parse(comment);
          ({ result: histories } = await paymentHistoryModel.find(
            { 'details.reservation_permlink': reservationPermlink },
          ));
        });
        it('should delete all history records if vote not expired', async () => {
          expect(histories).to.have.length(0);
        });
        it('should like post with correct data', async () => {
          expect(steemHelper.likePost.args[0][0]).to.be.deep.eq({
            key: Constants.upvoteBot.postingKey,
            voter: matchBot.bot_name,
            author: user.name,
            permlink: reviewPermlink,
            weight: 0,
          });
        });
      });
      describe('On errors', async () => {
        let histories;
        beforeEach(async () => {
          sinon.stub(steemHelper, 'getAccountsInfo').returns(Promise.resolve([{ posting: { account_auths: [] } }]));
          await commentParser.parse(comment);
          ({ result: histories } = await paymentHistoryModel.find(
            { 'details.reservation_permlink': reservationPermlink },
          ));
        });
        it('should delete histories if match bot exist but without permissions', async () => {
          expect(histories).to.have.length(0);
        });
        it('should not like if we dont have permissions to match bot', async () => {
          expect(steemHelper.likePost.notCalled).to.be.true;
        });
      });
    });

    describe('On many upvote bots, and not expired votes', async () => {
      let matchBot1;
      beforeEach(async () => {
        await PaymentHistory.updateOne({ type: 'review', userName: user.name }, { 'details.votesAmount': 1.8 });
        await PaymentHistory.updateOne({ type: 'beneficiary_fee', userName: beneficiaries[0].account }, { 'details.votesAmount': 0.2 });
        matchBot1 = await MatchBotFactory.Create({});
        await BotUpvoteFactory.Create({
          bot_name: matchBot1.bot_name,
          author: user.name,
          permlink: reviewPermlink,
          status: 'upvoted',
          createdAt: moment.utc().subtract(2, 'day'),
          currentVote: 1,
        });
      });
      describe('On success', async () => {
        let histories;
        beforeEach(async () => {
          sinon.stub(steemHelper, 'getAccountsInfo').returns(Promise.resolve([{ posting: { account_auths: [[Constants.upvoteBot.userName, 1]] } }]));
          await commentParser.parse(comment);
          ({ result: histories } = await paymentHistoryModel.find(
            { 'details.reservation_permlink': reservationPermlink },
          ));
        });
        it('should remove all votes from review', async () => {
          expect(steemHelper.likePost.calledTwice).to.be.true;
        });
        it('should remove all payments from DB', async () => {
          expect(histories).to.have.length(0);
        });
        it('should like with second bot with correct params', async () => {
          expect(steemHelper.likePost.args).to.be.deep.eq([[{
            key: Constants.upvoteBot.postingKey,
            voter: matchBot.bot_name,
            author: user.name,
            permlink: reviewPermlink,
            weight: 0,
          }], [{
            key: Constants.upvoteBot.postingKey,
            voter: matchBot1.bot_name,
            author: user.name,
            permlink: reviewPermlink,
            weight: 0,
          }]]);
        });
      });
      describe('On errors', async () => {
        let histories;
        beforeEach(async () => {
          sinon.stub(steemHelper, 'getAccountsInfo').returns(Promise.resolve([{ posting: { account_auths: [] } }]));
          await commentParser.parse(comment);
          ({ result: histories } = await paymentHistoryModel.find(
            { 'details.reservation_permlink': reservationPermlink },
          ));
        });
        it('should remove all histories if we have no permissions', async () => {
          expect(histories).to.have.length(0);
        });
        it('should bot call like method', async () => {
          expect(steemHelper.likePost.notCalled).to.be.true;
        });
      });
    });
  });

  describe('with upvote bot and expired vote', async () => {
    let matchBot, botUpvote;
    beforeEach(async () => {
      sinon.spy(steemHelper, 'likePost');

      matchBot = await MatchBotFactory.Create({});
      botUpvote = await BotUpvoteFactory.Create({
        bot_name: matchBot.bot_name,
        author: user.name,
        permlink: reviewPermlink,
        status: 'upvoted',
        createdAt: moment.utc().subtract(8, 'day'),
        currentVote: 1,
      });
    });
    describe('On one upvote bot and expired vote without downvotes', async () => {
      beforeEach(async () => {
        await PaymentHistory.updateOne(
          { type: 'review', userName: user.name },
          { 'details.votesAmount': botUpvote.currentVote - botUpvote.currentVote * (beneficiaries[0].weight / 10000) },
        );
        await PaymentHistory.updateOne(
          { type: 'beneficiary_fee', userName: beneficiaries[0].account },
          { 'details.votesAmount': botUpvote.currentVote * (beneficiaries[0].weight / 10000) },
        );
      });
      describe('On success', async () => {
        let histories;
        beforeEach(async () => {
          sinon.stub(steemHelper, 'getPostInfo').returns(Promise.resolve(
            { author: user.name, total_payout_value: '1.000 HIVE', active_votes: [{ voter: matchBot.bot_name, rshares: 10000 }] },
          ));
          await commentParser.parse(comment);
          ({ result: histories } = await paymentHistoryModel.find(
            { 'details.reservation_permlink': reservationPermlink },
          ));
        });
        it('should not delete only beneficiary and review histories', async () => {
          const result = _.filter(histories, (history) => history.type !== 'beneficiary_fee' && history.type !== 'review');
          expect(result).to.have.length(0);
        });
        it('should create correct debt from user who write review to the sponsor', async () => {
          const result = _.find(histories, (history) => history.type === 'review');
          expect(result.amount).to.be.eq(-0.9);
        });
        it('should create correct debt from beneficiary to the sponsor', async () => {
          const result = _.find(histories, (history) => history.type === 'beneficiary_fee');
          expect(result.amount).to.be.eq(-0.1);
        });
        it('should create debt for the amount of vote', async () => {
          const result = _.sumBy(histories, 'amount');
          expect(-result).to.be.eq(botUpvote.currentVote);
        });
      });
      describe('On errors', async () => {
        it('should delete all histories if vote not found', async () => {
          sinon.stub(steemHelper, 'getPostInfo').returns(Promise.resolve(
            { author: user.name, total_payout_value: '1.000 HIVE', active_votes: [{ voter: faker.name.firstName(), rshares: 10000 }] },
          ));
          await commentParser.parse(comment);
          const { result } = await paymentHistoryModel.find(
            { 'details.reservation_permlink': reservationPermlink },
          );
          expect(result).to.have.length(0);
        });
        it('should delete all histories if total payout eq 0', async () => {
          sinon.stub(steemHelper, 'getPostInfo').returns(Promise.resolve(
            { author: user.name, total_payout_value: '0.000 HIVE', active_votes: [{ voter: matchBot.bot_name, rshares: 10000 }] },
          ));
          await commentParser.parse(comment);
          const { result } = await paymentHistoryModel.find(
            { 'details.reservation_permlink': reservationPermlink },
          );
          expect(result).to.have.length(0);
        });
        it('should delete all histories if not found post', async () => {
          sinon.stub(steemHelper, 'getPostInfo').returns(Promise.resolve({ author: '' }));
          await commentParser.parse(comment);
          const { result } = await paymentHistoryModel.find(
            { 'details.reservation_permlink': reservationPermlink },
          );
          expect(result).to.have.length(0);
        });
      });
    });

    describe('On one upvote bot and expired vote with downvotes', async () => {
      beforeEach(async () => {
        await PaymentHistory.updateOne(
          { type: 'beneficiary_fee', userName: beneficiaries[0].account },
          { 'details.votesAmount': botUpvote.currentVote * (beneficiaries[0].weight / 10000) },
        );
        await PaymentHistory.updateOne(
          { type: 'review', userName: user.name },
          { 'details.votesAmount': botUpvote.currentVote - botUpvote.currentVote * (beneficiaries[0].weight / 10000) },
        );
      });
      describe('On success', async () => {
        let histories;
        beforeEach(async () => {
          sinon.stub(steemHelper, 'getPostInfo').returns(Promise.resolve({
            created: moment.utc().subtract(8, 'day').toString(),
            author: user.name,
            total_payout_value: '0.500 HIVE',
            curator_payout_value: '0.000 HIVE',
            active_votes: [{ voter: matchBot.bot_name, rshares: 10000 },
              { voter: faker.name.firstName(), rshares: -5000 }],
          }));
          await commentParser.parse(comment);
          ({ result: histories } = await paymentHistoryModel.find(
            { 'details.reservation_permlink': reservationPermlink },
          ));
        });
        it('should not delete histories with type review and beneficiary', async () => {
          const result = _.filter(histories, (history) => history.type === 'beneficiary_fee' || history.type === 'review');
          expect(result).to.have.length(2);
        });
        it('should create debt from user who write review to sponsor without downvote count', async () => {
          const result = _.find(histories, (history) => history.type === 'review');
          expect(result.amount).to.be.eq(-0.45);
        });
        it('should create debt from beneficiary to sponsor without downvote count ', async () => {
          const result = _.find(histories, (history) => history.type === 'beneficiary_fee');
          expect(result.amount).to.be.eq(-0.05);
        });
        it('should create total debts remaining after taking away dislikes', async () => {
          const result = _.sumBy(histories, 'amount');
          expect(-result).to.be.eq(botUpvote.currentVote / 2);
        });
      });
      describe('On downvote > matchbot vote, but payment exist', async () => {
        it('should create debt for all payout if it < match bot vote', async () => {
          sinon.stub(steemHelper, 'getPostInfo').returns(Promise.resolve({
            created: moment.utc().subtract(8, 'day').toString(),
            author: user.name,
            total_payout_value: '0.200 HIVE',
            curator_payout_value: '0.000 HIVE',
            active_votes: [{ voter: matchBot.bot_name, rshares: 10000 },
              { voter: faker.name.firstName(), rshares: -15000 }],
          }));
          await commentParser.parse(comment);
          const { result: histories } = await paymentHistoryModel.find(
            { 'details.reservation_permlink': reservationPermlink },
          );
          const result = _.sumBy(histories, 'amount');
          expect(-_.round(result, 2)).to.be.eq(0.2);
        });
        it('should create debt for all matchbot like if payout > match bot vote', async () => {
          sinon.stub(steemHelper, 'getPostInfo').returns(Promise.resolve({
            created: moment.utc().subtract(8, 'day').toString(),
            author: user.name,
            total_payout_value: '2.000 HIVE',
            curator_payout_value: '0.000 HIVE',
            active_votes: [{ voter: matchBot.bot_name, rshares: 10000 },
              { voter: faker.name.firstName(), rshares: -15000 }],
          }));
          await commentParser.parse(comment);
          const { result: histories } = await paymentHistoryModel.find(
            { 'details.reservation_permlink': reservationPermlink },
          );
          const result = _.sumBy(histories, 'amount');
          expect(-result).to.be.eq(botUpvote.currentVote);
        });
      });
    });
    describe('On many upvote bots and expired vote', async () => {
      let matchBot1, botUpvote1, histories;
      beforeEach(async () => {
        sinon.restore();
        sinon.spy(steemHelper, 'likePost');
        sinon.stub(steemHelper, 'getAccountsInfo').returns(Promise.resolve([{ posting: { account_auths: [[Constants.upvoteBot.userName, 1]] } }]));

        await PaymentHistory.updateOne(
          { type: 'beneficiary_fee', userName: beneficiaries[0].account },
          { 'details.votesAmount': botUpvote.currentVote * 2 * (beneficiaries[0].weight / 10000) },
        );
        await PaymentHistory.updateOne(
          { type: 'review', userName: user.name },
          { 'details.votesAmount': botUpvote.currentVote * 2 - botUpvote.currentVote * 2 * (beneficiaries[0].weight / 10000) },
        );
        matchBot1 = await MatchBotFactory.Create({});
        botUpvote1 = await BotUpvoteFactory.Create({
          bot_name: matchBot1.bot_name,
          author: user.name,
          permlink: reviewPermlink,
          status: 'upvoted',
          createdAt: moment.utc().subtract(4, 'day'),
          currentVote: 1,
        });
      });
      describe('without downvote', async () => {
        beforeEach(async () => {
          sinon.stub(steemHelper, 'getPostInfo').returns(Promise.resolve({
            created: moment.utc().subtract(8, 'day').toString(),
            author: user.name,
            total_payout_value: '2.000 HIVE',
            curator_payout_value: '0.000 HIVE',
            active_votes: [
              { voter: matchBot.bot_name, rshares: 10000 },
              { voter: matchBot1.bot_name, rshares: 10000 },
            ],
          }));
          await commentParser.parse(comment);
          ({ result: histories } = await paymentHistoryModel.find(
            { 'details.reservation_permlink': reservationPermlink },
          ));
        });
        it('should call like method once', async () => {
          expect(steemHelper.likePost.notCalled).to.be.true;
        });
        it('should create debt by all match bot vote sum', async () => {
          const result = _.sumBy(histories, 'amount');
          expect(-result).to.be.eq(botUpvote.currentVote + botUpvote1.currentVote);
        });
        it('should create correct debt for review history', async () => {
          const result = _.find(histories, (history) => history.type === 'review');
          expect(-result.amount).to.be.eq(1.8);
        });
        it('should create correct debt for beneficiary_fee history', async () => {
          const result = _.find(histories, (history) => history.type === 'beneficiary_fee');
          expect(-result.amount).to.be.eq(0.2);
        });
      });
      describe('with downvotes', async () => {
        beforeEach(async () => {
          sinon.restore();
          sinon.stub(steemHelper, 'getAccountsInfo').returns(Promise.resolve([{ posting: { account_auths: [[Constants.upvoteBot.userName, 1]] } }]));
          sinon.stub(steemHelper, 'getPostInfo').returns(Promise.resolve({
            created: moment.utc().subtract(8, 'day').toString(),
            author: user.name,
            total_payout_value: '1.500 HIVE',
            curator_payout_value: '0.000 HIVE',
            active_votes: [
              { voter: matchBot.bot_name, rshares: 10000 },
              { voter: matchBot1.bot_name, rshares: 10000 },
              { voter: faker.name.firstName(), rshares: -5000 },
            ],
          }));
          await commentParser.parse(comment);
          ({ result: histories } = await paymentHistoryModel.find(
            { 'details.reservation_permlink': reservationPermlink },
          ));
        });
        it('should recalculates debt taking into account downvote', async () => {
          const result = _.sumBy(histories, 'amount');
          expect(-result).to.be.eq(1.5);
        });
        it('should create correct debt for review history', async () => {
          const result = _.find(histories, (history) => history.type === 'review');
          expect(-result.amount).to.be.eq(1.35);
        });
        it('should create correct debt for beneficiary_fee history', async () => {
          const result = _.find(histories, (history) => history.type === 'beneficiary_fee');
          expect(-result.amount).to.be.eq(0.15);
        });
      });
      describe('if post doesnt exist', async () => {
        beforeEach(async () => {
          sinon.restore();
          sinon.stub(steemHelper, 'getPostInfo').returns(Promise.resolve({ author: '' }));
          sinon.stub(steemHelper, 'getAccountsInfo').returns(Promise.resolve([{ posting: { account_auths: [[Constants.upvoteBot.userName, 1]] } }]));
          await commentParser.parse(comment);
          ({ result: histories } = await paymentHistoryModel.find(
            { 'details.reservation_permlink': reservationPermlink },
          ));
        });
        it('should remove all debts if post not found', async () => {
          expect(histories).to.have.length(0);
        });
      });
    });
  });
});

describe('Rise review amount by guide', async () => {
  let campaign, mock;
  beforeEach(async () => {
    await dropDatabase();
    campaign = await CampaignFactory.Create({ status: 'active', activation_permlink: faker.random.string(10) });
    mock = await getMocksData({
      parent_author: campaign.users[0].name,
      parent_permlink: campaign.users[0].permlink,
      author: campaign.guideName,
      permlink: faker.random.string(10),
      title: faker.random.string(10),
      body: faker.random.string(100),
      metadata: JSON.stringify({
        waivioRewards: {
          type: 'waivio_raise_review_reward',
          riseAmount: 2,
          activationPermlink: campaign.activation_permlink,
        },
      }),
    });
  });
  describe('On OK', async () => {
    let result;
    beforeEach(async () => {
      await Campaign.updateOne({ _id: campaign._id },
        { $push: { users: { name: campaign.users[0].name, status: 'completed', permlink: faker.random.string(10) } } });
      await commentParser.parse(mock.operation);
      result = await Campaign.findOne({ _id: campaign._id });
    });
    it('should raise reward to user', async () => {
      const user = _.find(result.users, (usr) => usr.permlink === campaign.users[0].permlink);
      expect(user.rewardRaisedBy).to.be.eq(2);
    });
    it('should not raise reward to  another users', async () => {
      const sumRaised = _.sumBy(result.users, (usr) => {
        if (usr.permlink !== campaign.users[0].permlink) return usr.rewardRaisedBy;
      });
      expect(sumRaised).to.be.eq(0);
    });
    it('should add rise_reward_permlink to user', async () => {
      const user = _.find(result.users, (usr) => usr.permlink === campaign.users[0].permlink);
      expect(user.rise_reward_permlink).to.be.eq(mock.operation.permlink);
    });
  });
  describe('On error', async () => {
    let result;
    beforeEach(async () => {
      mock.operation.author = faker.name.firstName();
      await commentParser.parse(mock.operation);
      result = await Campaign.findOne({ _id: campaign._id });
    });
    it('should not raise reward to user if author not guide', async () => {
      const user = _.find(result.users, (usr) => usr.permlink === campaign.users[0].permlink);
      expect(user.rewardRaisedBy).to.be.eq(0);
    });
    it('should not add rise_reward_permlink to user if author not guide', async () => {
      const user = _.find(result.users, (usr) => usr.permlink === campaign.users[0].permlink);
      expect(user.rise_reward_permlink).to.be.undefined;
    });
  });
});

describe('Reduce review by user', async () => {
  let campaign, mock, amount;
  beforeEach(async () => {
    await dropDatabase();
    amount = _.random(1, 10);
    campaign = await CampaignFactory.Create({ status: 'active', activation_permlink: faker.random.string(10) });
    mock = await getMocksData({
      parent_author: campaign.users[0].name,
      parent_permlink: campaign.users[0].permlink,
      author: campaign.users[0].name,
      permlink: faker.random.string(10),
      title: faker.random.string(10),
      body: faker.random.string(100),
      metadata: JSON.stringify({
        waivioRewards: {
          type: 'waivio_reduce_review_reward',
          reduceAmount: amount,
          activationPermlink: campaign.activation_permlink,
        },
      }),
    });
  });
  afterEach(() => {
    sinon.restore();
  });
  describe('On OK assigned', async () => {
    let result;
    beforeEach(async () => {
      await commentParser.parse(mock.operation);
      result = await Campaign.findOne({ _id: campaign._id }).lean();
    });
    it('should add to user correct reduce permlink', async () => {
      const user = _.find(result.users, (usr) => usr.permlink === campaign.users[0].permlink);
      expect(user.reduce_reward_permlink).to.be.eq(mock.operation.permlink);
    });
    it('should add to user correct reduce amount', async () => {
      const user = _.find(result.users, (usr) => usr.permlink === campaign.users[0].permlink);
      expect(user.rewardReducedBy).to.be.eq(amount);
    });
  });

  describe('On OK completed', async () => {
    beforeEach(async () => {
      await Campaign.updateOne({ _id: campaign._id, users: { $elemMatch: { name: campaign.users[0].name } } }, { 'users.$.status': 'completed' });
    });

    describe('pending', async () => {
      let botUpvote;
      beforeEach(async () => {
        await Campaign.updateOne({ _id: campaign._id }, { reward: 1 });
        botUpvote = await BotUpvoteFactory.Create({
          reward: 40,
          amountToVote: 40,
          author: campaign.users[0].name,
          reservationPermlink: campaign.users[0].permlink,
          bot_name: faker.random.string(5),
        });
      });
      it('should remove upvote record if reduce> reward', async () => {
        await commentParser.parse(mock.operation);
        const result = await BotUpvote.findOne({ _id: botUpvote._id });
        expect(result).to.be.null;
      });
      it('should set new amount to vote after reduce', async () => {
        const newReward = 20;
        await Campaign.updateOne({ _id: campaign._id }, { reward: newReward });
        await commentParser.parse(mock.operation);
        const result = await BotUpvote.findOne({ _id: botUpvote._id });
        expect(result.amountToVote).to.be
          .eq((botUpvote.reward - amount * 2) * (botUpvote.amountToVote / botUpvote.reward));
      });
    });

    describe('not executed', async () => {
      let botUpvote;
      beforeEach(async () => {
        sinon.stub(steemHelper, 'getVotingInfo').returns(Promise.resolve({ voteWeight: 10, currentVotePower: 10 }));
        sinon.stub(steemHelper, 'likePost').returns(Promise.resolve({ result: true }));
        botUpvote = await BotUpvoteFactory.Create({
          status: 'upvoted',
          reward: 40,
          amountToVote: 40,
          author: campaign.users[0].name,
          reservationPermlink: campaign.users[0].permlink,
          bot_name: faker.random.string(5),
        });
      });
      it('should reVote if botUpvote not executed', async () => {
        await commentParser.parse(mock.operation);
        expect(steemHelper.likePost.calledOnce).to.be.true;
      });
      it('should update botUpvoteRecord after vote', async () => {
        await commentParser.parse(mock.operation);
        const result = await BotUpvote.findOne({ _id: botUpvote._id });
        expect(result.currentVote).to.be.eq(10);
      });
    });

    describe('executed', async () => {
      let botUpvote, beneficiaries, reviewPermlink, paymentAmount;
      beforeEach(async () => {
        botUpvote = await BotUpvoteFactory.Create({
          executed: true,
          status: 'upvoted',
          reward: 30,
          amountToVote: 30,
          author: campaign.users[0].name,
          reservationPermlink: campaign.users[0].permlink,
          bot_name: faker.random.string(5),
        });
        beneficiaries = [{ account: faker.name.firstName(), weight: 300 }];
        reviewPermlink = faker.random.string();
        const types = ['review', 'beneficiary_fee'];
        paymentAmount = 15;
        for (const type of types) {
          await PaymentHistoryFactory.Create({
            amount: type === 'review' ? paymentAmount * 0.97 : paymentAmount * 0.03,
            type,
            permlink: campaign.users[0].permlink,
            sponsor: campaign.guideName,
            userName: type === 'review' ? campaign.users[0].name : beneficiaries[0].account,
            beneficiaries,
            reviewPermlink,
          });
        }
        await commentParser.parse(mock.operation);
      });
      it('should recount review debt with right amount', async () => {
        const result = await PaymentHistory.findOne({ type: 'review' });
        expect(result.amount).to.be.eq((paymentAmount - amount) * 0.97);
      });
      it('should not update votesAmount field', async () => {
        const result = await PaymentHistory.findOne({ type: 'review' });
        expect(result.details.votesAmount).to.be.eq(0);
      });
    });
  });

  describe('On error', async () => {
    let result;
    beforeEach(async () => {
      mock.operation.author = faker.name.firstName();
      await commentParser.parse(mock.operation);
      result = await Campaign.findOne({ _id: campaign._id });
    });
    it('should not reduce reward to user if author not user', async () => {
      const user = _.find(result.users, (usr) => usr.permlink === campaign.users[0].permlink);
      expect(user.rewardReducedBy).to.be.eq(0);
    });
    it('should not add reduce_reward_permlink to user if author not user', async () => {
      const user = _.find(result.users, (usr) => usr.permlink === campaign.users[0].permlink);
      expect(user.reduce_reward_permlink).to.be.undefined;
    });
  });
});

describe('Restore reservation', async () => {
  let userName, guideName, mock, permlink;
  beforeEach(async () => {
    userName = faker.random.string();
    guideName = faker.random.string();
    permlink = faker.random.string();
    mock = {
      parent_author: userName,
      parent_permlink: permlink,
      author: guideName,
      permlink: faker.random.string(10),
      title: faker.random.string(10),
      body: faker.random.string(100),
      json_metadata: JSON.stringify({ waivioRewards: { type: 'restore_reservation_by_guide' } }),
    };
  });
  describe('On assigned user', async () => {
    let campaign;
    beforeEach(async () => {
      await dropDatabase();
      const _id = new ObjectID();
      const users = [{
        name: userName,
        status: RESERVATION_STATUSES.REJECTED,
        object_permlink: faker.random.string(),
        hiveCurrency: 1,
        rewardRaisedBy: 0,
        permlink,
        rootName: userName,
        _id,
      }];
      campaign = await CampaignFactory.Create({
        status: 'active', activation_permlink: faker.random.string(10), users, guideName,
      });
    });
    it('should change user status to assigned', async () => {
      await commentParser.parse(mock);
      const result = await Campaign.findOne({ _id: campaign._id }).lean();
      expect(result.users[0].status).to.be.eq(RESERVATION_STATUSES.ASSIGNED);
    });
    it('should not create debt if user not complete campaign', async () => {
      await commentParser.parse(mock);
      const result = await PaymentHistory.findOne({ userName }).lean();
      expect(result).to.be.null;
    });
    it('should not do anything with another comment author', async () => {
      mock.author = faker.random.string(10);
      await commentParser.parse(mock);
      const result = await Campaign.findOne({ _id: campaign._id }).lean();
      expect(result.users[0].status).to.be.eq(RESERVATION_STATUSES.REJECTED);
    });
  });

  describe('On completed user', async () => {
    let campaign, beneficiary, weight;
    beforeEach(async () => {
      await dropDatabase();
      const _id = new ObjectID();
      beneficiary = faker.random.string();
      weight = _.random(1000, 5000);
      const users = [{
        name: userName,
        status: RESERVATION_STATUSES.REJECTED,
        object_permlink: faker.random.string(),
        hiveCurrency: 1,
        rewardRaisedBy: 0,
        rootName: userName,
        permlink,
        _id,
      }];
      const payments = [{
        reservationId: _id,
        userName,
        objectPermlink: users[0].object_permlink,
        postPermlink: faker.random.string(),
        postTitle: faker.random.string(),
        status: RESERVATION_STATUSES.REJECTED,
        rootAuthor: userName,
      }];
      sinon.stub(steemHelper, 'getPostInfo').returns(Promise.resolve({ beneficiaries: [{ account: beneficiary, weight }] }));
      campaign = await CampaignFactory.Create({
        status: 'active', activation_permlink: faker.random.string(10), users, payments, guideName,
      });
    });
    afterEach(() => {
      sinon.restore();
    });
    it('should change user status to completed', async () => {
      await commentParser.parse(mock);
      const result = await Campaign.findOne({ _id: campaign._id }).lean();
      expect(result.users[0].status).to.be.eq(RESERVATION_STATUSES.COMPLETED);
    });
    it('should change payment status to active', async () => {
      await commentParser.parse(mock);
      const result = await Campaign.findOne({ _id: campaign._id }).lean();
      expect(result.payments[0].status).to.be.eq(RESERVATION_STATUSES.ACTIVE);
    });
    it('should create payment histories to user', async () => {
      await commentParser.parse(mock);
      const amount = _.round((campaign.reward / campaign.users[0].hiveCurrency) * ((10000 - weight) / 10000), 3);
      const result = await PaymentHistory.findOne({ userName }).lean();
      expect(_.round(result.amount, 3)).to.be.eq(amount);
    });
    it('should create beneficiary debt', async () => {
      await commentParser.parse(mock);
      const amount = _.round((campaign.reward / campaign.users[0].hiveCurrency) * (weight / 10000), 3);
      const result = await PaymentHistory.findOne({ userName: beneficiary }).lean();
      expect(_.round(result.amount, 3)).to.be.eq(amount);
    });
    it('should create index, campaign, referral debt', async () => {
      await commentParser.parse(mock);
      const amount = _.round((campaign.reward / campaign.users[0].hiveCurrency) * 0.05, 3);
      const result = await PaymentHistory.find({
        type: {
          $in: [PAYMENT_HISTORIES_TYPES.REFERRAL_SERVER_FEE, PAYMENT_HISTORIES_TYPES.CAMPAIGNS_SERVER_FEE, PAYMENT_HISTORIES_TYPES.INDEX_FEE],
        },
      }).lean();
      expect(_.round(_.sumBy(result, 'amount'), 3)).to.be.eq(amount);
    });
  });
});
