const moment = require('moment');
const {
  chai, chaiHttp, app, faker, ObjectID, dropDatabase, sinon, User, _, render, hiveOperations
} = require('test/testHelper');
const {
  BlacklistFactory, CampaignFactory, PaymentFactory, SubscriptionFactory, UserFactory,
  WobjectFactory, PostFactory, PaymentHistoryFactory, AppendObjectFactory, WobjectSubscriptionFactory,
} = require('test/factories');
const { RESERVATION_STATUSES, CAMPAIGN_STATUSES } = require('constants/constants');
const Campaign = require('models/campaignModel');

chai.use(chaiHttp);
chai.should();
const { expect } = chai;

describe('Campaigns', async () => {
  describe('GET/ with geo', async () => {
    before(async () => {
      await dropDatabase();
      for (let i = 0; i < 50; i++) {
        if (i > 30) {
          await CampaignFactory.Create({ requiredObject: `obj${i}`, status: 'active' });
        } else {
          await CampaignFactory.Create({ requiredObject: `obj${i}`, coordinates: [i + 10, i + 10], status: 'active' });
        }
        const obj = await WobjectFactory.Create({ author_permlink: `obj${i}` });
        const longitude = _.random(10, 15);
        await AppendObjectFactory.Create({ rootWobj: obj.author_permlink, body: `{"latitude":90,"longitude":${longitude}}`, name: 'map' });
      }
      for (let i = 0; i < 30; i++) {
        await CampaignFactory.Create({ requiredObject: 'obj1', status: 'active' });
        await CampaignFactory.Create({ requiredObject: 'obj1', coordinates: [i + 10, i + 10], status: 'active' });
      }
      const object = await WobjectFactory.Create({ author_permlink: 'obj', coordinates: [0, 0] });
      await AppendObjectFactory.Create({ rootWobj: object.author_permlink, body: '{"latitude":0,"longitude":0}', name: 'map' });
      await CampaignFactory.Create({ requiredObject: 'obj', coordinates: [10, 10], status: 'pending' });
    });

    describe('GET/ with area geo', async () => {
      describe('in wrapper', async () => {
        it('should get error with one coordinates', async () => {
          const res = await chai.request(app)
            .post('/campaigns-api/campaigns/all')
            .send({ area: [null, 120], radius: 10000000, limit: 50 });

          res.should.have.status(422);
        });

        it('should get all campaigns without coordinates', async () => {
          const res = await chai.request(app)
            .post('/campaigns-api/campaigns/all')
            .send({ radius: 10000000, limit: 50 });

          res.should.have.status(200);
          res.body.campaigns.length.should.to.be.eq(50);
        });

        it('should get all campaigns without radius', async () => {
          const res = await chai.request(app)
            .post('/campaigns-api/campaigns/all')
            .send({ area: [20, 120], limit: 50 });

          res.should.have.status(200);
        });

        it('should get error campaigns with invalid latitude', async () => {
          const res = await chai.request(app)
            .post('/campaigns-api/campaigns/all')
            .send({ area: [91, 120], radius: 10000000, limit: 50 });

          res.should.have.status(422);
        });

        it('should get error campaigns with invalid longtitude', async () => {
          const res = await chai.request(app)
            .post('/campaigns-api/campaigns/all')
            .send({ area: [90, 181], radius: 10000000, limit: 50 });

          res.should.have.status(422);
        });

        it('should get all campaigns by distance sort', async () => {
          const res = await chai.request(app)
            .post('/campaigns-api/campaigns/all')
            .send({
              area: [20, 120], radius: 100000000, limit: 50, sort: 'proximity',
            });

          res.should.have.status(200);
          expect(res.body.campaigns[0].distance < res.body.campaigns[res.body.campaigns.length - 1].distance).to.be.eq(true);
        });
      });
      describe('without wrapper', async () => {
        it('should get all campaigns with geo', async () => {
          const res = await chai.request(app)
            .post('/campaigns-api/campaigns/all')
            .send({
              requiredObject: 'obj1', area: [90, 10], radius: 5000000,
            });

          res.should.have.status(200);
          res.body.campaigns.length.should.to.be.eq(61);
        });

        it('should get error with one coordinates', async () => {
          const res = await chai.request(app)
            .post('/campaigns-api/campaigns/all')
            .send({
              requiredObject: 'obj1', area: [null, 120], radius: 10000000, limit: 50,
            });

          res.should.have.status(422);
        });

        it('should get all campaigns without coordinates', async () => {
          const res = await chai.request(app)
            .post('/campaigns-api/campaigns/all')
            .send({ requiredObject: 'obj1', radius: 10000000 });

          res.should.have.status(200);
          res.body.campaigns.length.should.to.be.eq(61);
        });

        it('should get all campaigns without radius', async () => {
          const res = await chai.request(app)
            .post('/campaigns-api/campaigns/all')
            .send({ requiredObject: 'obj1', area: [20, 120], limit: 50 });

          res.should.have.status(200);
        });

        it('should get error campaigns with invalid latitude', async () => {
          const res = await chai.request(app)
            .post('/campaigns-api/campaigns/all')
            .send({
              requiredObject: 'obj1', area: [91, 120], radius: 10000000, limit: 50,
            });

          res.should.have.status(422);
        });

        it('should get error campaigns with invalid longtitude', async () => {
          const res = await chai.request(app)
            .post('/campaigns-api/campaigns/all')
            .send({
              requiredObject: 'obj1', area: [90, 181], radius: 10000000, limit: 50,
            });

          res.should.have.status(422);
        });

        it('should get all campaigns by distance sort', async () => {
          const res = await chai.request(app)
            .post('/campaigns-api/campaigns/all')
            .send({
              area: [20, 120], radius: 100000000, limit: 50, sort: 'proximity',
            });

          res.should.have.status(200);
          expect(res.body.campaigns[0].distance < res.body.campaigns[res.body.campaigns.length - 1].distance).to.be.eq(true);
        });
      });
    });
    describe('GET/ with curent user coordinations geo', async () => {
      describe('in wrapper', async () => {
        it('should get all campaigns with geo', async () => {
          const res = await chai.request(app)
            .post('/campaigns-api/campaigns/all')
            .send({ coordinates: [20, 120], limit: 50 });

          res.should.have.status(200);
          res.body.campaigns.length.should.to.be.eq(50);
        });

        it('should get error with one coordinates', async () => {
          const res = await chai.request(app)
            .post('/campaigns-api/campaigns/all')
            .send({ coordinates: [null, 120], limit: 50 });

          res.should.have.status(200);
        });

        it('should get all campaigns with without coordinates', async () => {
          const res = await chai.request(app)
            .post('/campaigns-api/campaigns/all')
            .send({ limit: 50 });

          res.should.have.status(200);
          res.body.campaigns.length.should.to.be.eq(50);
        });

        it('should get error campaigns with invalid latitude', async () => {
          const res = await chai.request(app)
            .post('/campaigns-api/campaigns/all')
            .send({ coordinates: [91, 120], limit: 50 });

          res.should.have.status(200);
        });

        it('should get error campaigns with invalid longtitude', async () => {
          const res = await chai.request(app)
            .post('/campaigns-api/campaigns/all')
            .send({ coordinates: [90, 181], limit: 50 });

          res.should.have.status(200);
        });
      });
      describe('without wrapper', async () => {
        it('should get error with one coordinates', async () => {
          const res = await chai.request(app)
            .post('/campaigns-api/campaigns/all')
            .send({ requiredObject: 'obj1', area: [null, 120], limit: 50 });

          res.should.have.status(422);
        });

        it('should get all campaigns without coordinates', async () => {
          const res = await chai.request(app)
            .post('/campaigns-api/campaigns/all')
            .send({ requiredObject: 'obj1' });

          res.should.have.status(200);
          res.body.campaigns.length.should.to.be.eq(61);
        });

        it('should get all campaigns without radius', async () => {
          const res = await chai.request(app)
            .post('/campaigns-api/campaigns/all')
            .send({ requiredObject: 'obj1', area: [20, 120], limit: 50 });

          res.should.have.status(200);
        });

        it('should get error campaigns with invalid latitude', async () => {
          const res = await chai.request(app)
            .post('/campaigns-api/campaigns/all')
            .send({ requiredObject: 'obj1', area: [91, 120], limit: 50 });

          res.should.have.status(422);
        });

        it('should get error campaigns with invalid longtitude', async () => {
          const res = await chai.request(app)
            .post('/campaigns-api/campaigns/all')
            .send({ requiredObject: 'obj1', area: [90, 181], limit: 50 });

          res.should.have.status(422);
        });
      });
    });
  });
  describe('GET/ without geo', async () => {
    const userName = 'userName';
    const guideName = 'guideName';

    before(async () => {
      await dropDatabase();
      for (let i = 0; i < 30; i++) {
        let users = [];
        const _id = new ObjectID();
        let campaignStatus = 'pending';
        const status = ['active', 'rejected'];
        const paymentData = await PaymentFactory.Create({ userName, status: status[i % 2], reservationId: _id });

        if (i % 2 === 0) {
          let approved_object = { object_permlink: 'obj', permlink: 'permlink3' };

          campaignStatus = 'active';
          if (i % 4 === 0) {
            approved_object = { object_permlink: 'obj2', permlink: 'permlink2' };
          }
          users = [{
            name: userName, object_permlink: approved_object.object_permlink, permlink: approved_object.permlink, hiveCurrency: 1, _id,
          }];
        }
        await CampaignFactory.Create({
          guideName: `${userName}${i}`,
          users,
          payments: [paymentData],
          status: campaignStatus,
          requiredObject: `obj${i}`,
          userRequirements: { minPosts: i, minFollowers: i },
          reward: (i * 2) + 10,
        });
        await WobjectFactory.Create({ author_permlink: `obj${i}` });
      }
      for (let i = 0; i < 13; i++) {
        let users = [];

        if (i % 2 === 0) {
          let approved_object = { object_permlink: 'obj', permlink: 'permlink3' };

          if (i % 4 === 0) {
            approved_object = { object_permlink: 'obj2', permlink: 'permlink2' };
          }
          users = [{
            name: userName, object_permlink: approved_object.object_permlink, permlink: approved_object.permlink, hiveCurrency: 1,
          }];
        }
        const campaign = await CampaignFactory.Create({
          guideName,
          users,
          status: 'active',
          requiredObject: `obj${i + 31}`,
          userRequirements: { minPosts: i + 31, minFollowers: i + 31 },
          reward: (i * 7) + 10,
        });

        if (i % 2 === 0) {
          await Campaign.changeStatus(campaign._id, 'inactive');
        }
        await WobjectFactory.Create({ author_permlink: `obj${i + 31}` });
      }
    });
    describe('in wrapper', async () => {
      const user_follows = [];

      before(async () => {
        await UserFactory.Create({
          name: 'userForEligable', count_posts: 5, users_follow: ['user1', 'user2', 'user3'], followers_count: 3,
        });
        await UserFactory.Create({ name: 'userName', count_posts: 10, followers_count: 5 });
        for (let i = 0; i < 15; i++) {
          await UserFactory.Create({
            name: `userName${i}`, count_posts: i * 2, users_follow: user_follows, followers_count: user_follows.length,
          });
          await user_follows.push(`user_follow${i}`);
        }
      });
      describe('GET/ eligable', async () => {
        it('should get all eligable campaigns', async () => {
          const res = await chai.request(app)
            .post('/campaigns-api/campaigns/eligible')
            .send({ userName: 'userForEligable', limit: 50 });

          res.should.have.status(200);
          res.body.campaigns.length.should.to.be.eq(2);
        });
      });
      describe('GET/ reserved', async () => {
        it('should get all reserved campaigns', async () => {
          const res = await chai.request(app)
            .post('/campaigns-api/campaigns/reserved')
            .send({ userName: 'userName', limit: 50 });

          res.should.have.status(200);
          res.body.campaigns.length.should.to.be.eq(15);
        });
      });
      describe('sorting', async () => {
        it('should get all campaigns by max reward sorting', async () => {
          const res = await chai.request(app).post('/campaigns-api/campaigns/all').send({ sort: 'reward' });

          res.should.have.status(200);
          expect(res.body.campaigns[0].max_reward > res.body.campaigns[1].max_reward).to.be.eq(true);
        });

        it('should get all campaigns by max date sorting', async () => {
          const res = await chai.request(app).post('/campaigns-api/campaigns/all').send({ sort: 'date' });

          res.should.have.status(200);
          expect(res.body.campaigns[0].last_created > res.body.campaigns[1].last_created).to.be.eq(true);
        });
      });

      it('should get all campaigns', async () => {
        const res = await chai.request(app).post('/campaigns-api/campaigns/all');

        res.should.have.status(200);
        res.body.campaigns.length.should.to.be.eq(10);
      });
      it('should get all eligible campaigns with min posts 0 and min follows 0', async () => {
        const res = await chai.request(app)
          .post('/campaigns-api/campaigns/eligible')
          .send({ userName: 'userName0' });

        res.should.have.status(200);
        res.body.campaigns.length.should.to.be.eq(1);
      });

      it('should get all eligible campaigns with min posts 2 and min follows 1', async () => {
        const res = await chai.request(app)
          .post('/campaigns-api/campaigns/eligible')
          .send({ userName: 'userName1' });

        res.should.have.status(200);
        res.body.campaigns.length.should.to.be.eq(1);
      });

      it('should get all eligible campaigns with min posts 4 and min follows 2', async () => {
        const res = await chai.request(app)
          .post('/campaigns-api/campaigns/eligible')
          .send({ userName: 'userName2' });

        res.should.have.status(200);
        res.body.campaigns.length.should.to.be.eq(2);
      });

      it('should get all eligible campaigns with min posts 10 and min follows 5', async () => {
        const res = await chai.request(app)
          .post('/campaigns-api/campaigns/eligible')
          .send({ userName: 'userName5' });

        res.should.have.status(200);
        res.body.campaigns.length.should.to.be.eq(3);
      });

      it('should get all eligible campaigns with min posts 28 and min follows 14', async () => {
        const res = await chai.request(app)
          .post('/campaigns-api/campaigns/eligible')
          .send({ userName: 'userName14' });

        res.should.have.status(200);
        res.body.campaigns.length.should.to.be.eq(8);
      });

      it('should get all eligible campaigns if user have negative reputation', async () => {
        await UserFactory.Create({ name: 'asdaasd', wobjects_weight: -1000 });
        const res = await chai.request(app)
          .post('/campaigns-api/campaigns/eligible')
          .send({ userName: 'asdaasd' });

        res.should.have.status(200);
        res.body.campaigns.length.should.to.be.eq(1);
      });
      it('should has more return true', async () => {
        const res = await chai.request(app).post('/campaigns-api/campaigns/all').send({ limit: 15 });
        res.body.hasMore.should.to.be.true;
      });
      it('should has more return false', async () => {
        const res = await chai.request(app).post('/campaigns-api/campaigns/all').send({ limit: 43 });
        res.body.hasMore.should.to.be.false;
      });

      it('should get all active campaigns', async () => {
        const res = await chai.request(app)
          .post('/campaigns-api/campaigns/all')
          .send({ status: ['active'], limit: 50 });

        res.body.campaigns.length.should.to.be.eq(21);
        res.should.have.status(200);
      });

      it('should get all campaigns with skip', async () => {
        const res = await chai.request(app).post('/campaigns-api/campaigns/all').send({ skip: 15 });

        res.body.campaigns.length.should.to.be.eq(6);
        res.should.have.status(200);
      });

      it('should get all campaigns with limit', async () => {
        const res = await chai.request(app).post('/campaigns-api/campaigns/all').send({ limit: 5 });

        res.body.campaigns.length.should.to.be.eq(5);
        res.should.have.status(200);
      });

      it('should get all active campaigns with limit', async () => {
        const res = await chai.request(app)
          .post('/campaigns-api/campaigns/all')
          .send({ status: ['active'], limit: 5 });

        res.body.campaigns.length.should.to.be.eq(5);
        res.should.have.status(200);
      });

      it('should get guide campaigns with active status', async () => {
        const res = await chai.request(app)
          .post('/campaigns-api/campaigns/all')
          .send({ guideNames: [guideName] });

        res.body.campaigns.length.should.to.be.eq(6);
        res.should.have.status(200);
      });

      it('should get many guides campaigns with active status', async () => {
        const res = await chai.request(app)
          .post('/campaigns-api/campaigns/all')
          .send({ guideNames: [guideName, 'userName0'] });

        res.body.campaigns.length.should.to.be.eq(7);
        res.should.have.status(200);
      });

      it('should get users campaigns', async () => {
        const res = await chai.request(app)
          .post('/campaigns-api/campaigns/reserved')
          .send({ userName, limit: 20 });

        res.body.campaigns.length.should.to.be.eq(15);
        res.should.have.status(200);
      });

      it('should get users active campaigns', async () => {
        const res = await chai.request(app)
          .post('/campaigns-api/campaigns/reserved')
          .send({ userName, limit: 20 });
        res.body.campaigns.length.should.to.be.eq(15);
        res.should.have.status(200);
      });
      it('should get users active and inactive campaigns', async () => {
        const res = await chai.request(app)
          .post('/campaigns-api/campaigns/reserved')
          .send({ userName, limit: 20, status: ['active', 'pending'] });
        res.body.campaigns.length.should.to.be.eq(15);
        res.should.have.status(200);
      });
      it('should get active and inactive campaigns', async () => {
        const res = await chai.request(app)
          .post('/campaigns-api/campaigns/all')
          .send({ status: ['active', 'pending'], limit: 100 });

        res.body.campaigns.length.should.to.be.eq(36);
        res.should.have.status(200);
      });
      it('should get campaigns by types', async () => {
        const res = await chai.request(app).post('/campaigns-api/campaigns/all').send({ types: ['reviews'], limit: 30 });

        res.body.campaigns.length.should.to.be.eq(21);
        res.should.have.status(200);
      });

      it('should get campaigns by incorrect type', async () => {
        const res = await chai.request(app).post('/campaigns-api/campaigns/all')
          .send({ types: ['revievghjws'] });

        res.body.campaigns.length.should.to.be.eq(0);
        res.should.have.status(200);
      });
    });

    describe('count campaigns in wrapper', async () => {
      before(async () => {
        await CampaignFactory.Create({ requiredObject: 'obj6' });
      });

      it('should return valid count', async () => {
        const res = await chai.request(app).post('/campaigns-api/campaigns/all')
          .send({ limit: 50, status: ['pending', 'active'] });

        res.should.have.status(200);
        res.body.campaigns.length.should.to.be.eq(36);
      });
    });

    describe('without wrapper', async () => {
      const requiredObject = 'obj55';
      before(async () => {
        await WobjectFactory.Create({ author_permlink: requiredObject });
        let status, guideName, approvedObject, paymentData;
        const paymentStatus = ['active', 'rejected'];
        const user_follows = [];

        for (let i = 0; i < 15; i++) {
          if (i % 2) {
            guideName = 'guide1';
            status = 'active';
            approvedObject = { object_permlink: 'obj1', permlink: 'permlink1' };
            await PostFactory.Create({ author: guideName, permlink: `permlink${i}` });
          } else {
            guideName = 'guide2';
            status = 'pending';
            approvedObject = { object_permlink: 'obj2', permlink: 'permlink2' };
            await PostFactory.Create({ author: guideName, permlink: `permlink${i}` });
          }
          paymentData = await PaymentFactory.Create({ userName, status: paymentStatus[i % 2] });

          const users = [{
            name: 'userName', object_permlink: approvedObject.object_permlink, permlink: approvedObject.permlink, hiveCurrency: 1,
          }];
          const campaignsParams = {
            reward: 10 + i,
            requiredObject,
            userRequirements: { minPosts: i, minFollowers: i },
            status,
            guideName,
            users,
            payments: [paymentData],
            activation_permlink: `permlink${i}`,
          };
          if (i === 5) Object.assign(campaignsParams, { budget: 5, reward: 3 });
          await CampaignFactory.Create(campaignsParams);
          await UserFactory.Create({
            name: `userName${i}_`, count_posts: i * 2, users_follow: user_follows, followers_count: user_follows.length,
          });
          await UserFactory.Create({ name: `guide${i}` });
          await user_follows.push(`user_follow${i}`);
        }
        const findUser = await User.findOne({ name: 'userName' });

        if (findUser) {
          findUser.set({ count_posts: 10, users_follow: 5 });
          findUser.save();
        } else {
          await UserFactory.Create({ name: 'userName', count_posts: 10, users_follow: 5 });
        }
      });

      it('check users length', async () => {
        const res = await chai.request(app)
          .post('/campaigns-api/campaigns/all')
          .send({ guideNames: ['guide1'], requiredObject });

        res.should.have.status(200);
        res.body.campaigns[0].users.length.should.to.be.eq(1);
      });

      it('check sponsors with required object and active campaigns', async () => {
        const res = await chai.request(app)
          .post('/campaigns-api/campaigns/all')
          .send({ requiredObject });

        res.should.have.status(200);
        res.body.sponsors.length.should.to.be.eq(1);
      });

      it('check sponsors with only active campaigns', async () => {
        const res = await chai.request(app).post('/campaigns-api/campaigns/all');

        res.should.have.status(200);
        res.body.sponsors.length.should.to.be.eq(17);
      });

      it('check assigned objects', async () => {
        const res = await chai.request(app)
          .post('/campaigns-api/campaigns/reserved')
          .send({
            status: ['active'], userName: 'userName', requiredObject,
          });
        const { objects } = res.body.campaigns[16];

        res.should.have.status(200);
        expect(objects.length).to.be.eq(1);
        expect(objects[0].assigned).to.be.eq(true);
      });

      it('check not assigned objects with approved false', async () => {
        const res = await chai.request(app)
          .post('/campaigns-api/campaigns/eligible')
          .send({ status: ['active'], userName: 'userName2_', requiredObject: 'obj0' });
        const { objects } = res.body.campaigns[0];

        res.should.have.status(200);
        expect(objects.length).to.be.eq(3);
        expect(objects[0].assigned).to.be.eq(false);
      });

      it('check assigned with status active', async () => {
        const res = await chai.request(app)
          .post('/campaigns-api/campaigns/all')
          .send({ status: ['active'], userName: 'userName', requiredObject });
        const { objects } = res.body.campaigns[5];

        res.should.have.status(200);
        expect(objects[0].assigned).to.be.eq(true);
        expect(objects[1].assigned).to.be.eq(false);
        expect(objects[2].assigned).to.be.eq(false);
      });

      it('check assigned permlink', async () => {
        const res = await chai.request(app)
          .post('/campaigns-api/campaigns/all')
          .send({ status: ['active'], userName: 'userName', requiredObject });
        const { objects } = res.body.campaigns[5];

        res.should.have.status(200);
        expect(objects[0].permlink).to.be.eq('permlink1');
      });

      it('check campaign permlink', async () => {
        const res = await chai.request(app)
          .post('/campaigns-api/campaigns/all')
          .send({ userName: 'userName', requiredObject });

        res.should.have.status(200);
        expect(res.body.campaigns[5].activation_permlink).to.be.exist;
      });

      it('check assigned without user', async () => {
        const res = await chai.request(app)
          .post('/campaigns-api/campaigns/all')
          .send({ status: ['active'], requiredObject });
        const { objects } = res.body.campaigns[0];

        res.should.have.status(200);
        expect(objects[0].assigned).to.be.eq(false);
        expect(objects[1].assigned).to.be.eq(false);
        expect(objects[2].assigned).to.be.eq(false);
      });

      it('check assigned with status active and not enough balance for reward', async () => {
        const res = await chai.request(app)
          .post('/campaigns-api/campaigns/all')
          .send({ status: ['active'], userName: 'userName', requiredObject });
        const { objects } = res.body.campaigns[0];

        res.should.have.status(200);
        expect(objects[0].assigned).to.be.eq(true);
        expect(objects[1].assigned).to.be.eq(false);
        expect(objects[2].assigned).to.be.eq(false);
      });

      it('check assigned with status pending', async () => {
        const res = await chai.request(app)
          .post('/campaigns-api/campaigns/all')
          .send({ status: ['pending'], userName: 'userName9_', requiredObject });
        const { objects } = res.body.campaigns[0];

        res.should.have.status(200);
        expect(objects[0].assigned).to.be.eq(false);
        expect(objects[1].assigned).to.be.eq(false);
        expect(objects[2].assigned).to.be.eq(false);
      });

      it('check assigned forbidden', async () => {
        const res = await chai.request(app)
          .post('/campaigns-api/campaigns/all')
          .send({ userName: 'userName9_', requiredObject });
        const { objects } = res.body.campaigns[0];

        res.should.have.status(200);
        expect(objects[0].assigned).to.be.eq(false);
        expect(objects[1].assigned).to.be.eq(false);
        expect(objects[2].assigned).to.be.eq(false);
      });

      it('check assigned without currentUserName', async () => {
        const res = await chai.request(app)
          .post('/campaigns-api/campaigns/all')
          .send({ requiredObject });
        const { objects } = res.body.campaigns[0];

        res.should.have.status(200);
        expect(objects[0].assigned).to.be.eq(false);
        expect(objects[1].assigned).to.be.eq(false);
        expect(objects[2].assigned).to.be.eq(false);
      });

      it('should get all campaigns with required object', async () => {
        const res = await chai.request(app)
          .post('/campaigns-api/campaigns/all')
          .send({ requiredObject });

        res.should.have.status(200);
        res.body.campaigns.length.should.to.be.eq(7);
      });

      it('should get all campaigns with current user name', async () => {
        const res = await chai.request(app)
          .post('/campaigns-api/campaigns/all')
          .send({ userName: 'userName9_', requiredObject });

        res.should.have.status(200);
        res.body.campaigns.length.should.to.be.eq(7);
      });

      it('should get all campaigns with min posts 0 and min follows 0', async () => {
        const res = await chai.request(app)
          .post('/campaigns-api/campaigns/eligible')
          .send({
            userName: 'userName0_', requiredObject, limit: 50,
          });

        res.should.have.status(200);
        res.body.campaigns.length.should.to.be.eq(0);
      });

      it('should get all campaigns with min posts 2 and min follows 1', async () => {
        const res = await chai.request(app)
          .post('/campaigns-api/campaigns/eligible')
          .send({ userName: 'userName1_', requiredObject });

        res.should.have.status(200);
        res.body.campaigns.length.should.to.be.eq(1);
      });

      it('should get all campaigns with min posts 4 and min follows 2', async () => {
        const res = await chai.request(app)
          .post('/campaigns-api/campaigns/eligible')
          .send({
            userName: 'userName2_', requiredObject,
          });

        res.should.have.status(200);
        res.body.campaigns.length.should.to.be.eq(1);
      });

      it('should get all campaigns with min posts 20 and min follows 10', async () => {
        const res = await chai.request(app)
          .post('/campaigns-api/campaigns/eligible')
          .send({
            status: ['active'], userName: 'userName10_', requiredObject,
          });

        res.should.have.status(200);
        res.body.campaigns.length.should.to.be.eq(5);
      });

      it('should get all campaigns with invalid name', async () => {
        const res = await chai.request(app)
          .post('/campaigns-api/campaigns/all')
          .send({ userName: 'dfgdf', requiredObject, limit: 50 });

        res.should.have.status(200);
        res.body.campaigns.length.should.to.be.eq(7);
      });

      it('should has more return true', async () => {
        const res = await chai.request(app)
          .post('/campaigns-api/campaigns/all')
          .send({ requiredObject, limit: 5 });

        res.body.hasMore.should.to.be.true;
      });

      it('should has more return false', async () => {
        const res = await chai.request(app)
          .post('/campaigns-api/campaigns/all')
          .send({ requiredObject, limit: 15 });

        res.body.hasMore.should.to.be.false;
      });

      it('should get all active campaigns', async () => {
        const res = await chai.request(app)
          .post('/campaigns-api/campaigns/all')
          .send({ status: ['active'], requiredObject, limit: 50 });

        res.body.campaigns.length.should.to.be.eq(7);
        res.should.have.status(200);
      });

      it('should get guide campaigns with active status', async () => {
        const res = await chai.request(app)
          .post('/campaigns-api/campaigns/all')
          .send({ guideNames: ['guide1'], status: ['active'], requiredObject });

        res.body.campaigns.length.should.to.be.eq(7);
        res.should.have.status(200);
      });

      it('should get guide campaigns', async () => {
        const res = await chai.request(app)
          .post('/campaigns-api/campaigns/all')
          .send({ guideNames: ['guide2'], requiredObject, status: ['pending', 'active'] });

        res.body.campaigns.length.should.to.be.eq(8);
        res.should.have.status(200);
      });

      it('should get many guides campaigns', async () => {
        const res = await chai.request(app)
          .post('/campaigns-api/campaigns/all')
          .send({ guideNames: ['guide1', 'guide2'], requiredObject });

        res.body.campaigns.length.should.to.be.eq(7);
        res.should.have.status(200);
      });

      it('should get users campaigns', async () => {
        const res = await chai.request(app)
          .post('/campaigns-api/campaigns/reserved')
          .send({ userName: 'userName', requiredObject });

        res.body.campaigns.length.should.to.be.eq(22);
        res.should.have.status(200);
      });

      it('should get users active campaigns', async () => {
        const res = await chai.request(app)
          .post('/campaigns-api/campaigns/reserved')
          .send({
            userName: 'userName', status: ['active'], requiredObject,
          });

        res.body.campaigns.length.should.to.be.eq(22);
        res.should.have.status(200);
      });
      it('should get users active and inactive campaigns', async () => {
        const res = await chai.request(app)
          .post('/campaigns-api/campaigns/reserved')
          .send({
            userName: 'userName', status: ['active', 'pending'], requiredObject,
          });

        res.body.campaigns.length.should.to.be.eq(30);
        res.should.have.status(200);
      });
      it('should get active and inactive campaigns', async () => {
        const res = await chai.request(app)
          .post('/campaigns-api/campaigns/all')
          .send({ status: ['active', 'pending'], requiredObject, limit: 100 });

        res.body.campaigns.length.should.to.be.eq(15);
        res.should.have.status(200);
      });
      it('should get only active campaigns with approved objects', async () => {
        const res = await chai.request(app)
          .post('/campaigns-api/campaigns/reserved')
          .send({ userName: 'userName', status: ['active'], requiredObject });

        res.body.campaigns.length.should.to.be.eq(22);
        res.should.have.status(200);
      });
      it('should get campaigns by types', async () => {
        const res = await chai.request(app)
          .post('/campaigns-api/campaigns/all')
          .send({ types: ['reviews'], requiredObject });

        res.body.campaigns.length.should.to.be.eq(7);
        res.should.have.status(200);
      });

      it('should get campaigns by incorrect type', async () => {
        const res = await chai.request(app)
          .post('/campaigns-api/campaigns/all')
          .send({ types: ['revievghjws'], requiredObject });

        res.body.campaigns.length.should.to.be.eq(0);
        res.should.have.status(200);
      });

      describe('sorting', async () => {
        it('should get all campaigns by reward sorting', async () => {
          const res = await chai.request(app)
            .post('/campaigns-api/campaigns/reserved')
            .send({ userName: 'userName', requiredObject });

          res.should.have.status(200);
          expect(res.body.campaigns[0].reward > res.body.campaigns[1].reward).to.be.eq(true);
        });

        it('should get all campaigns by date sorting', async () => {
          const res = await chai.request(app)
            .post('/campaigns-api/campaigns/reserved')
            .send({
              userName: 'userName', requiredObject, approved: true, sort: 'date',
            });

          res.should.have.status(200);
          expect(res.body.campaigns[0].expired_at > res.body.campaigns[1].expired_at).to.be.eq(true);
        });
      });

      describe('check count users in approved objects', async () => {
        const requiredObject = 'obj55';
        const objects = [];

        before(async () => {
          await dropDatabase();
          await WobjectFactory.Create({ author_permlink: requiredObject });
          await UserFactory.Create({ name: 'user1' });
          await UserFactory.Create({ name: 'user2' });
          for (let i = 0; i < 7; i++) {
            await WobjectFactory.Create({ author_permlink: `obj${i}` });
            objects.push(`obj${i}`);
          }

          const campaignsParams = {
            requiredObject,
            status: 'active',
            users: [{
              name: 'user1',
              object_permlink: 'obj0',
              permlink: 'permlink',
              hiveCurrency: 1,
            }, {
              name: 'user2',
              object_permlink: 'obj2',
              permlink: 'permlink',
              hiveCurrency: 1,
            }, {
              name: 'user1',
              object_permlink: 'obj2',
              permlink: 'permlink',
              hiveCurrency: 1,
            }, {
              name: 'user1',
              object_permlink: 'obj6',
              permlink: 'permlink',
              hiveCurrency: 1,
            },
            ],
            objects,
            activation_permlink: 'permlink1',
          };

          await CampaignFactory.Create(campaignsParams);
        });

        it('check count users in objects', async () => {
          const res = await chai.request(app).post('/campaigns-api/campaigns/all').send({ requiredObject });
          const campaignObjects = res.body.campaigns[0].objects;

          res.should.have.status(200);
          campaignObjects[0].count_users.should.to.be.eq(1);
          campaignObjects[1].count_users.should.to.be.eq(0);
          campaignObjects[2].count_users.should.to.be.eq(2);
          campaignObjects[3].count_users.should.to.be.eq(0);
          campaignObjects[4].count_users.should.to.be.eq(0);
          campaignObjects[5].count_users.should.to.be.eq(0);
          campaignObjects[6].count_users.should.to.be.eq(1);
        });
      });

      describe('check assign to campaign with same main object', async () => {
        const mainObject = 'mainObject';
        const activationPermlink1 = 'campaign_permlink1';
        const activation_permlink2 = 'campaign_permlink2';

        beforeEach(async () => {
          await dropDatabase();
          await UserFactory.Create({ name: 'guide1' });
          await UserFactory.Create({
            name: 'user1', count_posts: 5, users_follow: ['u1', 'u2'], followers_count: 2,
          });
          await UserFactory.Create({
            name: 'user2', count_posts: 5, users_follow: ['u1', 'u2'], followers_count: 2,
          });
          await UserFactory.Create({
            name: 'user3', count_posts: 5, users_follow: ['u1', 'u2'], followers_count: 2,
          });
          await UserFactory.Create({
            name: 'user4', count_posts: 5, users_follow: ['u1', 'u2'], followers_count: 2,
          });
          await WobjectFactory.Create({ author_permlink: mainObject });
          await WobjectFactory.Create({ author_permlink: 'obj1' });
          await WobjectFactory.Create({ author_permlink: 'obj2' });
          await WobjectFactory.Create({ author_permlink: 'obj3' });
          await CampaignFactory.Create({
            requiredObject: mainObject,
            status: 'active',
            guideName: 'guide1',
            objects: ['obj1', 'obj2', 'obj3'],
            users: [{
              name: 'user1',
              object_permlink: 'obj1',
              permlink: 'reserved_permlink1',
              hiveCurrency: 1,
            }, {
              name: 'user2',
              object_permlink: 'obj2',
              permlink: 'reserved_permlink2',
              hiveCurrency: 1,
            }],
            activation_permlink: activationPermlink1,
          });

          await CampaignFactory.Create({
            requiredObject: mainObject,
            status: 'active',
            guideName: 'guide1',
            objects: ['obj1', 'obj2', 'obj3'],
            users: [{
              status: 'completed',
              name: 'user3',
              object_permlink: 'obj1',
              permlink: 'reserved_permlink1',
              hiveCurrency: 1,
            },
            ],
            activation_permlink: activation_permlink2,
          });
        });
        describe('without wrapper', async () => {
          it('should not return eligible campaigns with assigned user to main object', async () => {
            const res = await chai.request(app)
              .post('/campaigns-api/campaigns/eligible')
              .send({ userName: 'user1', requiredObject: mainObject });

            res.should.have.status(200);
            expect(res.body.campaigns.length).to.be.eq(0);
          });

          it('should return eligible campaigns with not assign user to main object and have completed', async () => {
            const res = await chai.request(app)
              .post('/campaigns-api/campaigns/eligible')
              .send({ userName: 'user3', requiredObject: mainObject });
            res.should.have.status(200);
            expect(res.body.campaigns.length).to.be.eq(2);
          });

          it('should return eligible campaigns with not assign user to main object', async () => {
            const res = await chai.request(app)
              .post('/campaigns-api/campaigns/eligible')
              .send({ userName: 'user4', requiredObject: mainObject });
            res.should.have.status(200);
            expect(res.body.campaigns.length).to.be.eq(2);
          });
        });
        describe('in wrapper', async () => {
          it('should not return eligible campaigns with assigned user to main object', async () => {
            const res = await chai.request(app)
              .post('/campaigns-api/campaigns/eligible')
              .send({ userName: 'user1' });
            res.should.have.status(200);
            expect(res.body.campaigns.length).to.be.eq(0);
          });

          it('should return eligible campaigns with not assign user to main object and have completed', async () => {
            const res = await chai.request(app)
              .post('/campaigns-api/campaigns/eligible')
              .send({ userName: 'user3' });
            res.should.have.status(200);
            expect(res.body.campaigns.length).to.be.eq(1);
            expect(res.body.campaigns[0].count).to.be.eq(2);
          });

          it('should return eligible campaigns with not assign user to main object', async () => {
            const res = await chai.request(app)
              .post('/campaigns-api/campaigns/eligible')
              .send({ userName: 'user4' });
            res.should.have.status(200);
            expect(res.body.campaigns.length).to.be.eq(1);
            expect(res.body.campaigns[0].count).to.be.eq(2);
          });
        });
      });
      describe('check frequency assign', async () => {
        const mainObject = 'mainObject';
        const activationPermlink1 = 'campaign_permlink1';
        const activation_permlink2 = 'campaign_permlink2';

        beforeEach(async () => {
          await dropDatabase();
          await UserFactory.Create({ name: 'guide1' });
          await UserFactory.Create({
            name: 'user1', count_posts: 5, users_follow: ['u1', 'u2'], followers_count: 2,
          });
          await UserFactory.Create({
            name: 'user2', count_posts: 5, users_follow: ['u1', 'u2'], followers_count: 2,
          });
          await UserFactory.Create({
            name: 'user3', count_posts: 5, users_follow: ['u1', 'u2'], followers_count: 2,
          });
          await UserFactory.Create({
            name: 'user4', count_posts: 5, users_follow: ['u1', 'u2'], followers_count: 2,
          });
          await UserFactory.Create({
            name: 'user5', count_posts: 5, users_follow: ['u1', 'u2'], followers_count: 2,
          });
          await WobjectFactory.Create({ author_permlink: mainObject });
          await WobjectFactory.Create({ author_permlink: 'obj1' });
          await WobjectFactory.Create({ author_permlink: 'obj2' });
          await WobjectFactory.Create({ author_permlink: 'obj3' });
          await CampaignFactory.Create({
            requiredObject: mainObject,
            status: 'active',
            guideName: 'guide1',
            objects: ['obj1', 'obj2', 'obj3'],
            frequency_assign: 4,
            users: [{
              name: 'user1',
              object_permlink: 'obj1',
              permlink: 'reserved_permlink1',
              status: 'completed',
              createdAt: moment().subtract(4, 'days').subtract(1, 'minutes'),
              hiveCurrency: 1,
            }, {
              name: 'user2',
              object_permlink: 'obj1',
              permlink: 'reserved_permlink2',
              status: 'completed',
              createdAt: moment().subtract(3, 'days'),
              hiveCurrency: 1,
            }, {
              name: 'user3',
              object_permlink: 'obj1',
              permlink: 'reserved_permlink3',
              status: 'completed',
              createdAt: moment().subtract(5, 'days'),
              hiveCurrency: 1,
            }, {
              name: 'user4',
              object_permlink: 'obj1',
              permlink: 'reserved_permlink3',
              status: 'completed',
              createdAt: moment().subtract(1, 'days'),
              hiveCurrency: 1,
            }, {
              name: 'user5',
              object_permlink: 'obj1',
              permlink: 'reserved_permlink3',
              status: 'completed',
              createdAt: moment().subtract(10, 'days'),
              hiveCurrency: 1,
            }, {
              name: 'user5',
              object_permlink: 'obj1',
              permlink: 'reserved_permlink3',
              status: 'completed',
              createdAt: moment().subtract(5, 'days'),
              hiveCurrency: 1,
            },
            ],
            activation_permlink: activationPermlink1,
          });
          await CampaignFactory.Create({
            requiredObject: mainObject,
            status: 'active',
            guideName: 'guide1',
            frequency_assign: 4,
            objects: ['obj1', 'obj2', 'obj3'],
            users: [{
              status: 'completed',
              name: 'user1',
              object_permlink: 'obj1',
              permlink: 'reserved_permlink1',
              createdAt: moment().subtract(10, 'days'),
              hiveCurrency: 1,
            }, {
              name: 'user2',
              object_permlink: 'obj1',
              permlink: 'reserved_permlink2',
              status: 'completed',
              createdAt: moment().subtract(13, 'days'),
              hiveCurrency: 1,
            }, {
              name: 'user4',
              object_permlink: 'obj1',
              permlink: 'reserved_permlink3',
              status: 'completed',
              createdAt: moment().subtract(2, 'days'),
              hiveCurrency: 1,
            }, {
              name: 'user5',
              object_permlink: 'obj1',
              permlink: 'reserved_permlink3',
              status: 'completed',
              createdAt: moment().subtract(6, 'days'),
              hiveCurrency: 1,
            },
            ],
            activation_permlink: activation_permlink2,
          });
        });
        it('should return eligible campaigns with not exceeded frequency in both campaigns', async () => {
          const res = await chai.request(app)
            .post('/campaigns-api/campaigns/eligible')
            .send({ userName: 'user1', requiredObject: mainObject });
          res.should.have.status(200);
          expect(res.body.campaigns.length).to.be.eq(2);
        });
        it('should not return eligible campaigns with exceeded frequency in one campaign', async () => {
          const res = await chai.request(app)
            .post('/campaigns-api/campaigns/eligible')
            .send({ userName: 'user2', requiredObject: mainObject });
          res.should.have.status(200);
          expect(res.body.campaigns.length).to.be.eq(0);
        });
        it('should not return eligible campaigns with not exceeded frequency in all campaigns', async () => {
          const res = await chai.request(app)
            .post('/campaigns-api/campaigns/eligible')
            .send({ userName: 'user4', requiredObject: mainObject });
          res.should.have.status(200);
          expect(res.body.campaigns.length).to.be.eq(0);
        });

        it('should return eligible campaigns with one completed in one campaign', async () => {
          const res = await chai.request(app)
            .post('/campaigns-api/campaigns/eligible')
            .send({ userName: 'user3', requiredObject: mainObject });
          res.should.have.status(200);
          expect(res.body.campaigns.length).to.be.eq(2);
        });
      });
      describe('check assigned if budget equals reward and has free place', async () => {
        let requiredObject = 'requiredObject', campaignsParams;

        beforeEach(async () => {
          await dropDatabase();
          await UserFactory.Create({ name: 'guide' });
          await UserFactory.Create({ name: 'user' });
          await UserFactory.Create({ name: 'userName' });
          await WobjectFactory.Create({ author_permlink: requiredObject });
          await WobjectFactory.Create({ author_permlink: 'object' });
          campaignsParams = {
            budget: 1,
            reward: 1,
            requiredObject,
            userRequirements: { minPosts: 0, minFollowers: 0 },
            status: 'active',
            guideName: 'guide',
            objects: ['object'],
            users: [],
            activation_permlink: 'campaign_permlink',
          };
        });

        it('check assigned with free place', async () => {
          await CampaignFactory.Create(campaignsParams);
          const res = await chai.request(app)
            .post('/campaigns-api/campaigns/all')
            .send({ status: ['active'], userName: 'userName', requiredObject });
          const { objects } = res.body.campaigns[0];
          res.should.have.status(200);
          expect(objects[0].assigned).to.be.eq(false);
        });

        it('check assigned with user assigned', async () => {
          campaignsParams.users = [{
            name: 'user',
            object_permlink: 'object',
            permlink: 'approved_obj_permlink',
            status: 'assigned',
            hiveCurrency: 1,
          },
          ];
          await CampaignFactory.Create(campaignsParams);
          const res = await chai.request(app)
            .post('/campaigns-api/campaigns/all')
            .send({ status: ['active'], userName: 'userName', requiredObject });
          res.should.have.status(200);
          expect(res.body.campaigns.length).to.be.eq(0);
        });

        it('check assigned with current user assigned', async () => {
          campaignsParams.users = [{
            name: 'user',
            object_permlink: 'object',
            permlink: 'approved_obj_permlink',
            status: 'assigned',
            hiveCurrency: 1,
          },
          ];
          await CampaignFactory.Create(campaignsParams);
          const res = await chai.request(app)
            .post('/campaigns-api/campaigns/all')
            .send({ userName: 'user', requiredObject });

          res.should.have.status(200);
          expect(res.body.campaigns.length).to.be.eq(1);
        });
      });
      describe('check assigned if budget equals reward and campaign user unassigned', async () => {
        const requiredObject = 'requiredObject';

        beforeEach(async () => {
          await dropDatabase();
          await UserFactory.Create({ name: 'guide' });
          await UserFactory.Create({ name: 'user' });
          await UserFactory.Create({ name: 'userName' });
          await WobjectFactory.Create({ author_permlink: requiredObject });
          await WobjectFactory.Create({ author_permlink: 'object' });
          const campaignsParams = {
            budget: 1,
            reward: 1,
            requiredObject,
            userRequirements: { minPosts: 0, minFollowers: 0 },
            status: 'active',
            guideName: 'guide',
            objects: ['object'],
            users: [{
              name: 'user',
              object_permlink: 'object',
              permlink: 'approved_obj_permlink',
              status: 'unassigned',
              hiveCurrency: 1,
            }],
            activation_permlink: 'campaign_permlink',
          };

          await CampaignFactory.Create(campaignsParams);
        });

        it('check assigned', async () => {
          const res = await chai.request(app)
            .post('/campaigns-api/campaigns/all')
            .send({ status: ['active'], userName: 'userName', requiredObject });
          const { objects } = res.body.campaigns[0];
          res.should.have.status(200);
          expect(objects[0].assigned).to.be.eq(false);
        });
      });
      describe('check assigned if budget equals reward and campaign user completed last month', async () => {
        const requiredObject = 'requiredObject';
        let campaignsParams;

        beforeEach(async () => {
          await dropDatabase();
          const _id = new ObjectID();
          await UserFactory.Create({ name: 'guide' });
          await UserFactory.Create({ name: 'user' });
          await UserFactory.Create({ name: 'userName' });
          await WobjectFactory.Create({ author_permlink: requiredObject });
          await WobjectFactory.Create({ author_permlink: 'object' });
          campaignsParams = {
            budget: 1,
            reward: 1,
            requiredObject,
            userRequirements: { minPosts: 0, minFollowers: 0 },
            status: 'active',
            guideName: 'guide',
            objects: ['object'],
            users: [{
              _id,
              name: 'user',
              object_permlink: 'object',
              permlink: 'approved_obj_permlink',
              status: 'completed',
              hiveCurrency: 1,
            }],
            payments: [{
              reservationId: _id,
              userName: 'user',
              objectPermlink: 'object',
              postPermlink: faker.random.string(),
              rootAuthor: 'user',
              postTitle: faker.random.string(),
              status: 'active',
            }],
            activation_permlink: 'campaign_permlink',
          };
        });

        it('check assigned with status active', async () => {
          await CampaignFactory.Create(campaignsParams);
          const res = await chai.request(app)
            .post('/campaigns-api/campaigns/all')
            .send({ userName: 'userName', requiredObject });

          expect(res.body.campaigns.length).to.be.eq(0);
        });
        it('check assigned with eligable', async () => {
          await CampaignFactory.Create(campaignsParams);
          const res = await chai.request(app)
            .post('/campaigns-api/campaigns/eligible')
            .send({ userName: 'userName', requiredObject });

          expect(res.body.campaigns.length).to.be.eq(0);
        });

        it('check assigned with reserved', async () => {
          campaignsParams.users[0].status = 'assigned';
          await CampaignFactory.Create(campaignsParams);
          const res = await chai.request(app)
            .post('/campaigns-api/campaigns/reserved')
            .send({ userName: 'user', requiredObject });
          expect(res.body.campaigns.length).to.be.eq(1);
          expect(res.body.campaigns[0].objects[0].assigned).to.be.true;
        });
      });
      describe('check assigned if budget equals reward and campaign user completed last month', async () => {
        const requiredObject = 'requiredObject';

        beforeEach(async () => {
          await dropDatabase();
          await UserFactory.Create({ name: 'guide' });
          await UserFactory.Create({ name: 'user' });
          await UserFactory.Create({ name: 'userName' });
          await WobjectFactory.Create({ author_permlink: requiredObject });
          await WobjectFactory.Create({ author_permlink: 'object' });
          const campaignsParams = {
            budget: 1,
            reward: 1,
            requiredObject,
            userRequirements: { minPosts: 0, minFollowers: 0 },
            status: 'active',
            guideName: 'guide',
            objects: ['object'],
            users: [{
              name: 'user',
              object_permlink: 'object',
              permlink: 'approved_obj_permlink',
              status: 'completed',
              createdAt: moment().subtract(1, 'month').format(),
              hiveCurrency: 1,
            }],
            activation_permlink: 'campaign_permlink',
          };

          await CampaignFactory.Create(campaignsParams);
        });

        it('check assigned', async () => {
          const res = await chai.request(app)
            .post('/campaigns-api/campaigns/all')
            .send({ userName: 'userName', requiredObject });
          const { objects } = res.body.campaigns[0];

          res.should.have.status(200);
          expect(objects[0].assigned).to.be.eq(false);
        });
      });
      describe('check assigned with not reserved days', async () => {
        const requiredObject = 'requiredObject';
        let campaignsParams;

        beforeEach(async () => {
          await dropDatabase();
          const currentDay = moment().format('dddd').toLowerCase();
          const _id = new ObjectID();
          await UserFactory.Create({ name: 'guide' });
          await UserFactory.Create({ name: 'user' });
          await UserFactory.Create({ name: 'userName' });
          await WobjectFactory.Create({ author_permlink: requiredObject });
          await WobjectFactory.Create({ author_permlink: 'object' });
          campaignsParams = {
            reservation_timetable: {
              [currentDay]: false,
            },
            budget: 1,
            reward: 1,
            requiredObject,
            userRequirements: { minPosts: 0, minFollowers: 0 },
            status: 'active',
            guideName: 'guide',
            objects: ['object'],
            users: [{
              _id,
              name: 'user',
              object_permlink: 'object',
              permlink: 'approved_obj_permlink',
              status: 'completed',
              createdAt: moment().subtract(1, 'month').format(),
              hiveCurrency: 1,
            }],
            payments: [{
              reservationId: _id,
              userName: 'user',
              objectPermlink: 'object',
              postPermlink: faker.random.string(),
              postTitle: faker.random.string(),
              status: 'active',
              rootAuthor: 'user',
            }],
            activation_permlink: 'campaign_permlink',
          };
        });

        it('check assigned with active status', async () => {
          await CampaignFactory.Create(campaignsParams);
          const res = await chai.request(app)
            .post('/campaigns-api/campaigns/all')
            .send({ userName: 'userName', requiredObject });

          expect(res.body.campaigns.length).to.be.eq(1);
        });

        it('check eligible', async () => {
          await CampaignFactory.Create(campaignsParams);
          const res = await chai.request(app)
            .post('/campaigns-api/campaigns/eligible')
            .send({ userName: 'userName', requiredObject });
          res.should.have.status(200);
          expect(res.body.campaigns.length).to.be.eq(0);
        });

        it('check reserved', async () => {
          campaignsParams.users[0].status = 'assigned';
          await CampaignFactory.Create(campaignsParams);
          const res = await chai.request(app)
            .post('/campaigns-api/campaigns/reserved')
            .send({ userName: 'user', requiredObject });
          res.should.have.status(200);
          expect(res.body.campaigns.length).to.be.eq(1);
          expect(res.body.campaigns[0].objects[0].assigned).to.be.true;
        });
      });
      describe('check assigned with reserved days', async () => {
        const requiredObject = 'requiredObject';

        beforeEach(async () => {
          await dropDatabase();
          const currentDay = moment().format('dddd').toLowerCase();
          const _id = new ObjectID();
          await UserFactory.Create({ name: 'guide' });
          await UserFactory.Create({ name: 'user' });
          await UserFactory.Create({ name: 'userName' });
          await WobjectFactory.Create({ author_permlink: requiredObject });
          await WobjectFactory.Create({ author_permlink: 'object' });
          const campaignsParams = {
            reservation_timetable: {
              [currentDay]: true,
            },
            budget: 1,
            reward: 1,
            requiredObject,
            userRequirements: { minPosts: 0, minFollowers: 0 },
            status: 'active',
            guideName: 'guide',
            objects: ['object'],
            users: [{
              _id,
              name: 'user',
              object_permlink: 'object',
              permlink: 'approved_obj_permlink',
              status: 'completed',
              createdAt: moment().subtract(1, 'month').format(),
              hiveCurrency: 1,
            }],
            payments: [{
              reservationId: _id,
              rootAuthor: 'user',
              userName: 'user',
              objectPermlink: 'object',
              postPermlink: faker.random.string(),
              postTitle: faker.random.string(),
              status: 'active',
              createdAt: moment().subtract(1, 'month').format(),
            }],
            activation_permlink: 'campaign_permlink',
          };

          await CampaignFactory.Create(campaignsParams);
        });

        it('check assigned', async () => {
          const res = await chai.request(app)
            .post('/campaigns-api/campaigns/all')
            .send({ userName: 'userName', requiredObject });
          const { objects } = res.body.campaigns[0];

          res.should.have.status(200);
          expect(objects[0].assigned).to.be.eq(false);
        });

        it('check eligable', async () => {
          const res = await chai.request(app)
            .post('/campaigns-api/campaigns/eligible')
            .send({ userName: 'userName', requiredObject });

          res.should.have.status(200);
          expect(res.body.campaigns.length).to.be.eq(1);
        });
      });

      describe('check expertise filter', async () => {
        const requiredObject = 'requiredObject';

        beforeEach(async () => {
          await dropDatabase();
          await UserFactory.Create({ name: 'userName1', wobjects_weight: '5' });
          await UserFactory.Create({ name: 'userName2', wobjects_weight: '0' });
          await WobjectFactory.Create({ author_permlink: requiredObject });
          await WobjectFactory.Create({ author_permlink: 'object' });
          const campaignsParams = {
            budget: 1,
            reward: 1,
            requiredObject,
            userRequirements: { minPosts: 0, minFollowers: 0, minExpertise: 5 },
            status: 'active',
            guideName: 'guide',
            objects: ['object'],
            users: [],
            activation_permlink: 'campaign_permlink',
          };

          await CampaignFactory.Create(campaignsParams);
        });

        it('check expertise with allowed user', async () => {
          const res = await chai.request(app)
            .post('/campaigns-api/campaigns/all')
            .send({ userName: 'userName1', requiredObject });

          res.should.have.status(200);
          expect(res.body.campaigns[0].objects[0].assigned).to.be.eq(false);
        });
      });
    });
    describe('check total payed', async () => {
      let guideName, requiredObject;

      before(async () => {
        await dropDatabase();
        guideName = 'guide1';
        requiredObject = 'obj1';
        await WobjectFactory.Create({ author_permlink: requiredObject });
        await CampaignFactory.Create({ guideName, requiredObject, status: 'active' });
        await PaymentHistoryFactory.Create({ sponsor: guideName, type: 'transfer' });
        await PaymentHistoryFactory.Create({ sponsor: guideName, type: 'review' });
        await PaymentHistoryFactory.Create({ sponsor: guideName, type: 'review' });
        await PaymentHistoryFactory.Create({ sponsor: guideName, type: 'transfer', amount: 2.2 });
      });
      it('should return valid count', async () => {
        const res = await chai.request(app).post('/campaigns-api/campaigns/all').send({ requiredObject });

        res.should.have.status(200);
        res.body.campaigns.length.should.equal(1);
        res.body.campaigns[0].guide.totalPayed.should.equal(7.2);
      });
    });
  });

  describe('DELETE /', async () => {
    let campaign;

    before(async () => {
      campaign = await CampaignFactory.Create();
    });

    it('should delete campaign', async () => {
      const res = await chai.request(app).delete(`/campaigns-api/campaigns/${campaign._id}/`);

      res.should.have.status(200);
    });

    it('should not delete campaign with invalid id', async () => {
      const res = await chai.request(app).delete(`/campaigns/${new ObjectID()}/`);

      res.should.have.status(404);
    });
  });
  describe('POST /create_campaign', async () => {
    let campaignParams;

    beforeEach(async () => {
      campaignParams = {
        guideName: `${faker.name.firstName()}${faker.random.number()}`,
        name: `${faker.name.firstName()}${faker.random.number()}`,
        description: `${faker.lorem.words()}`,
        type: 'reviews',
        note: `${faker.lorem.words()}`,
        budget: 100,
        reward: 10.5,
        requirements: { minPhotos: 1 },
        userRequirements: { minFollowers: 1, minPosts: 1, minExpertise: 0 },
        objects: ['obj1', 'obj2', 'obj3'],
        commissionAgreement: 0.05,
        requiredObject: 'req_obj1',
        expired_at: faker.date.future(1),
      };
    });

    afterEach(() => {
      sinon.restore();
    });

    it('should create campaign with compensation account', async () => {
      campaignParams.compensationAccount = 'someAcc';
      const res = await chai.request(app).post('/campaigns-api/create_campaign').send(campaignParams);

      res.should.have.status(200);
      res.body.campaign.compensationAccount.should.be.eq('someAcc');
    });

    it('should update campaign with null compensation account to valid', async () => {
      const campaign = await CampaignFactory.Create(campaignParams);

      campaignParams.compensationAccount = 'someAcc';
      campaignParams.id = campaign.id;
      const res = await chai.request(app).post('/campaigns-api/create_campaign').send(campaignParams);

      res.should.have.status(200);
      res.body.campaign.compensationAccount.should.be.eq('someAcc');
    });

    it('should update campaign with valid compensation account to null', async () => {
      campaignParams.compensationAccount = 'someAcc';
      const campaign = await CampaignFactory.Create(campaignParams);

      campaignParams.compensationAccount = '';
      campaignParams.id = campaign.id;
      const res = await chai.request(app).post('/campaigns-api/create_campaign').send(campaignParams);

      res.should.have.status(200);
      res.body.campaign.compensationAccount.should.be.eq('');
    });

    it('should create campaign with valid data', async () => {
      const res = await chai.request(app).post('/campaigns-api/create_campaign').send(campaignParams);

      res.should.have.status(200);
    });

    it('should create campaign with valid app', async () => {
      sinon.stub(hiveOperations, 'getAccountInfo').returns(Promise.resolve(true));
      campaignParams.app = 'app';
      const res = await chai.request(app).post('/campaigns-api/create_campaign').send(campaignParams);

      res.should.have.status(200);
      res.body.campaign.app.should.be.eq('app');
    });

    it('should create campaign with invalid valid app', async () => {
      sinon.stub(hiveOperations, 'getAccountInfo').returns(Promise.resolve(false));
      campaignParams.app = 'app';
      const res = await chai.request(app).post('/campaigns-api/create_campaign').send(campaignParams);

      res.should.have.status(200);
      expect(res.body.campaign.app).to.be.null;
    });

    it('should create campaign with default count of reservation days', async () => {
      const res = await chai.request(app).post('/campaigns-api/create_campaign').send(campaignParams);

      res.should.have.status(200);
      res.body.campaign.count_reservation_days.should.be.eq(1);
    });

    it('should create campaign with expertise reputation filter', async () => {
      campaignParams.userRequirements.minExpertise = 4;
      const res = await chai.request(app).post('/campaigns-api/create_campaign').send(campaignParams);

      res.should.have.status(200);
      res.body.campaign.userRequirements.minExpertise.should.be.eq(4);
    });

    it('should create campaign with minimum commissionAgreement', async () => {
      campaignParams.commissionAgreement = 0.05;
      const res = await chai.request(app).post('/campaigns-api/create_campaign').send(campaignParams);

      res.should.have.status(200);
      res.body.campaign.commissionAgreement.should.be.eq(0.05);
    });

    it('should create campaign with < minimum commissionAgreement', async () => {
      campaignParams.commissionAgreement = 0.04;
      const res = await chai.request(app).post('/campaigns-api/create_campaign').send(campaignParams);

      res.should.have.status(422);
    });

    it('should create campaign with maximum commissionAgreement', async () => {
      campaignParams.commissionAgreement = 1;
      const res = await chai.request(app).post('/campaigns-api/create_campaign').send(campaignParams);

      res.should.have.status(200);
      res.body.campaign.commissionAgreement.should.be.eq(1);
    });

    it('should create campaign with > maximum commissionAgreement', async () => {
      campaignParams.commissionAgreement = 1.01;
      const res = await chai.request(app).post('/campaigns-api/create_campaign').send(campaignParams);

      res.should.have.status(422);
    });

    it('should create campaign with usersLegalNotice', async () => {
      campaignParams.usersLegalNotice = 'bla';
      const res = await chai.request(app).post('/campaigns-api/create_campaign').send(campaignParams);

      res.should.have.status(200);
      res.body.campaign.usersLegalNotice.should.be.eq('bla');
    });

    it('should create campaign with empty usersLegalNotice', async () => {
      campaignParams.usersLegalNotice = null;
      const res = await chai.request(app).post('/campaigns-api/create_campaign').send(campaignParams);

      res.should.have.status(422);
    });

    it('should create campaign with agreementObjects', async () => {
      const objects = ['obj1', 'obj2'];

      campaignParams.agreementObjects = objects;
      const res = await chai.request(app).post('/campaigns-api/create_campaign').send(campaignParams);

      res.should.have.status(200);
      res.body.campaign.agreementObjects.should.be.eql(objects);
    });

    it('should create campaign with empty agreementObjects', async () => {
      const objects = [];

      campaignParams.agreementObjects = objects;
      const res = await chai.request(app).post('/campaigns-api/create_campaign').send(campaignParams);

      res.should.have.status(200);
      res.body.campaign.agreementObjects.should.be.eql(objects);
    });

    it('should create campaign with invalid agreementObjects', async () => {
      campaignParams.agreementObjects = '';
      const res = await chai.request(app).post('/campaigns-api/create_campaign').send(campaignParams);
      res.should.have.status(422);
    });

    it('should create campaign with count of reservation days', async () => {
      campaignParams.count_reservation_days = 5;
      const res = await chai.request(app).post('/campaigns-api/create_campaign').send(campaignParams);

      res.should.have.status(200);
      res.body.campaign.count_reservation_days.should.be.eq(5);
    });

    it('should create campaign with invalid count of reservation days', async () => {
      campaignParams.count_reservation_days = 'aa';
      const res = await chai.request(app).post('/campaigns-api/create_campaign').send(campaignParams);

      res.should.have.status(422);
    });

    it('should not create campaign without username', async () => {
      campaignParams.guideName = null;
      const res = await chai.request(app).post('/campaigns-api/create_campaign').send(campaignParams);

      res.should.have.status(422);
    });

    it('should not create campaign without type', async () => {
      campaignParams.type = null;
      const res = await chai.request(app).post('/campaigns-api/create_campaign').send(campaignParams);

      res.should.have.status(422);
    });

    it('should not create campaign with incorrect type', async () => {
      campaignParams.type = 'incorrect type';
      const res = await chai.request(app).post('/campaigns-api/create_campaign').send(campaignParams);

      res.should.have.status(422);
    });

    it('should not create campaign withount note', async () => {
      campaignParams.note = undefined;
      const res = await chai.request(app).post('/campaigns-api/create_campaign').send(campaignParams);

      res.should.have.status(200);
    });

    it('should not create campaign withount budget', async () => {
      campaignParams.budget = null;
      const res = await chai.request(app).post('/campaigns-api/create_campaign').send(campaignParams);

      res.should.have.status(422);
    });

    it('should not create campaign withount reward', async () => {
      campaignParams.reward = null;
      const res = await chai.request(app).post('/campaigns-api/create_campaign').send(campaignParams);

      res.should.have.status(422);
    });

    it('should not create campaign withount requirements', async () => {
      campaignParams.requirements = null;
      const res = await chai.request(app).post('/campaigns-api/create_campaign').send(campaignParams);

      res.should.have.status(422);
    });

    it('should not create campaign with requirements is empty', async () => {
      campaignParams.requirements = {};
      const res = await chai.request(app).post('/campaigns-api/create_campaign').send(campaignParams);

      res.should.have.status(422);
    });

    it('should not create campaign with requirements is empty', async () => {
      campaignParams.requirements = {};
      const res = await chai.request(app).post('/campaigns-api/create_campaign').send(campaignParams);

      res.should.have.status(422);
    });

    it('should not create campaign without user requirements', async () => {
      campaignParams.userRequirements = null;
      const res = await chai.request(app).post('/campaigns-api/create_campaign').send(campaignParams);

      res.should.have.status(422);
    });

    it('should not create campaign with user requirements is empty', async () => {
      campaignParams.userRequirements = {};
      const res = await chai.request(app).post('/campaigns-api/create_campaign').send(campaignParams);

      res.should.have.status(422);
    });

    it('should not create campaign without objects', async () => {
      campaignParams.objects = null;
      const res = await chai.request(app).post('/campaigns-api/create_campaign').send(campaignParams);

      res.should.have.status(422);
    });

    it('should not create campaign with empty objects', async () => {
      campaignParams.objects = {};
      const res = await chai.request(app).post('/campaigns-api/create_campaign').send(campaignParams);

      res.should.have.status(422);
    });

    it('should not create campaign with users', async () => {
      campaignParams.users = [new ObjectID()];
      const res = await chai.request(app).post('/campaigns-api/create_campaign').send(campaignParams);

      res.should.have.status(200);
      expect(res.body.campaign.users).to.be.eql([]);
    });

    it('should not create campaign with payments', async () => {
      campaignParams.payments = [new ObjectID()];
      const res = await chai.request(app).post('/campaigns-api/create_campaign').send(campaignParams);

      res.should.have.status(200);
      expect(res.body.campaign.payments).to.be.eql([]);
    });
  });
  describe('GET /show', async () => {
    let _campaign;

    before(async () => {
      _campaign = await CampaignFactory.Create();
    });

    // it('should get campaign', async () => {
    //   const res = await chai.request(app).get(`/campaigns-api/campaign/${_campaign._id}`);
    //
    //   res.should.have.status(200);
    //   expect(res.body.campaign).to.be.exist;
    // });

    it('should return error with invalid campaign', async () => {
      const res = await chai.request(app).get('/campaigns-api/campaign/kjgkjui');

      res.should.have.status(404);
    });

    it('should return empty with non exist campaign', async () => {
      const res = await chai.request(app).get(`/campaigns-api/campaign/${new ObjectID()}`);

      res.should.have.status(404);
    });
  });
  describe('campaigns dashboard /', async () => {
    const campaignStatus = ['pending', 'active', 'inactive', 'expired', 'deleted', 'payed'];
    const paymentsStatus = ['active', 'rejected'];
    let payments = [];

    before(async () => {
      await dropDatabase();
      const wobject = await WobjectFactory.Create();
      await UserFactory.Create({ name: 'guide1' });
      await UserFactory.Create({ name: 'anotherGuide' });
      for (let i = 0; i < 15; i++) {
        payments = [];
        for (let j = 0; j < 8; j++) {
          const paymentData = await PaymentFactory.Create({ userName: `user${i}`, status: paymentsStatus[(j * i) % 2] });

          payments.push(paymentData);
        }
        const campaign = await CampaignFactory.Create({
          guideName: i === 14 ? 'anotherGuide' : 'guide1',
          status: campaignStatus[i % 5],
          payments,
          requiredObject: wobject.author_permlink,
          objects: [faker.name.firstName()],
        });
        await WobjectFactory.Create({ author_permlink: campaign.objects[0] });
      }
    });
    it('should return success', async () => {
      const res = await chai.request(app).get('/campaigns-api/campaigns/dashboard/guide1');

      res.should.have.status(200);
      res.body.dashboard.campaigns.length.should.equal(14);
      res.body.dashboard.budget_total.should.exist;
    });

    it('should return empty', async () => {
      const res = await chai.request(app).get('/campaigns-api/campaigns/dashboard/guide2');

      res.should.have.status(200);
      res.body.dashboard.campaigns.length.should.equal(0);
    });
  });
  describe('validate activation /', async () => {
    let campaign1;
    const userName = 'eugenezh';

    before(async () => {
      campaign1 = await CampaignFactory.Create({
        guideName: 'eugenezh', status: 'pending', budget: 1.1, reward: 1,
      });
      await CampaignFactory.Create({
        guideName: 'eugenezh', status: 'pending', budget: 100, reward: 1,
      });
    });

    it('should return success', async () => {
      const res = await chai.request(app)
        .post('/campaigns-api/validate_activation')
        .send({ campaign_id: campaign1._id, guide_name: userName, permlink: 'permlink' });

      res.should.have.status(200);
      res.body.result.should.equal(true);
    });

    it('should return unprocessable entity with invalid campaign id', async () => {
      const res = await chai.request(app)
        .post('/campaigns-api/validate_activation')
        .send({ campaign_id: new ObjectID(), guide_name: userName, permlink: 'permlink' });

      res.should.have.status(422);
      res.body.success.should.equal(false);
    });

    it('should return unprocessable entity without permlink', async () => {
      const res = await chai.request(app)
        .post('/campaigns-api/validate_activation')
        .send({ campaign_id: campaign1._id, guide_name: userName });

      res.should.have.status(422);
      res.body.success.should.equal(false);
    });
  });
  describe('validate reservation /', async () => {
    const campaign_permlink1 = 'campaign_permlink1';
    const campaign_permlink2 = 'campaign_permlink2';

    beforeEach(async () => {
      await dropDatabase();
      await UserFactory.Create({ name: 'name1' });
      await WobjectFactory.Create({ author_permlink: 'obj1', coordinates: [20, 30], objects: ['obj1', 'obj2'] });
      await WobjectFactory.Create({ author_permlink: 'obj2', coordinates: [20, 30] });
      await CampaignFactory.Create({
        status: 'active', requiredObject: 'obj1', users: [], activation_permlink: campaign_permlink1,
      });
      await CampaignFactory.Create({
        status: 'pending', requiredObject: 'obj2', users: [], activation_permlink: campaign_permlink2,
      });
    });

    it('should return success', async () => {
      const res = await chai.request(app)
        .post('/campaigns-api/validate_reservation')
        .send({
          campaign_permlink: campaign_permlink1, user_name: 'name1', approved_object: 'obj1', reservation_permlink: 'permlink1',
        });

      res.should.have.status(200);
      res.body.result.should.equal(true);
    });

    it('should return error without user name', async () => {
      const res = await chai.request(app)
        .post('/campaigns-api/validate_reservation')
        .send({ campaign_permlink: campaign_permlink1, approved_object: 'obj1', reservation_permlink: 'permlink1' });

      res.should.have.status(422);
      res.body.success.should.equal(false);
    });

    it('should return error without approved object', async () => {
      const res = await chai.request(app)
        .post('/campaigns-api/validate_reservation')
        .send({ campaign_permlink: campaign_permlink1, user_name: 'name1', reservation_permlink: 'permlink1' });

      res.should.have.status(422);
      res.body.success.should.equal(false);
    });

    it('should return error with invalid user name', async () => {
      const res = await chai.request(app)
        .post('/campaigns-api/validate_reservation')
        .send({
          campaign_permlink: campaign_permlink1, user_name: 'asdasdasd', approved_object: 'obj1', reservation_permlink: 'permlink1',
        });

      res.should.have.status(422);
      res.body.success.should.equal(false);
    });

    it('should return error without reservation_permlink', async () => {
      const res = await chai.request(app)
        .post('/campaigns-api/validate_reservation')
        .send({ campaign_permlink: campaign_permlink1, user_name: 'name1', approved_object: 'obj1' });

      res.should.have.status(422);
      res.body.success.should.equal(false);
    });

    it('should return error with invalid object', async () => {
      const res = await chai.request(app)
        .post('/campaigns-api/validate_reservation')
        .send({
          campaign_permlink: campaign_permlink1, user_name: 'name1', approved_object: 'aasdad', reservation_permlink: 'permlink1',
        });

      res.should.have.status(422);
      res.body.success.should.equal(false);
    });

    it('should return error with invalid permlink', async () => {
      const res = await chai.request(app)
        .post('/campaigns-api/validate_reservation')
        .send({
          campaign_permlink: 'aaaasda', user_name: 'name1', approved_object: 'obj1', reservation_permlink: 'permlink1',
        });

      res.should.have.status(422);
      res.body.success.should.equal(false);
    });

    it('should return error with pending campaign', async () => {
      const res = await chai.request(app)
        .post('/campaigns-api/validate_reservation')
        .send({
          campaign_permlink: campaign_permlink2, user_name: 'name1', approved_object: 'obj1', reservation_permlink: 'permlink1',
        });

      res.should.have.status(422);
      res.body.success.should.equal(false);
    });
  });
  describe('validate reject reservation /', async () => {
    const campaign_permlink1 = 'campaign_permlink1';
    const campaign_permlink2 = 'campaign_permlink2';

    beforeEach(async () => {
      await dropDatabase();
      await CampaignFactory.Create({
        status: 'active',
        requiredObject: 'obj1',
        users: [
          {
            name: 'name1',
            object_permlink: 'obj_permlink',
            permlink: 'permlink',
            hiveCurrency: 1,
            status: 'assigned',
          },
        ],
        activation_permlink: campaign_permlink1,
      });
      await CampaignFactory.Create({
        status: 'active', requiredObject: 'obj1', users: [], activation_permlink: campaign_permlink2,
      });
    });

    it('should return success', async () => {
      const res = await chai.request(app)
        .post('/campaigns-api/validate_reject_reservation')
        .send({
          campaign_permlink: campaign_permlink1,
          user_name: 'name1',
          reservation_permlink: 'permlink',
          unreservation_permlink: 'unreservation_permlink',
        });

      res.should.have.status(200);
      res.body.result.should.equal(true);
    });

    it('should return error with invalid campaign permlink', async () => {
      const res = await chai.request(app)
        .post('/campaigns-api/validate_reject_reservation')
        .send({
          campaign_permlink: 'asdasd',
          user_name: 'name1',
          reservation_permlink: 'permlink',
          unreservation_permlink: 'unreservation_permlink',
        });

      res.should.have.status(422);
      res.body.success.should.equal(false);
    });

    it('should return error with not exist user', async () => {
      const res = await chai.request(app)
        .post('/campaigns-api/validate_reject_reservation')
        .send({
          campaign_permlink: campaign_permlink1,
          user_name: 'not_exist_user',
          reservation_permlink: 'permlink',
          unreservation_permlink: 'unreservation_permlink',
        });

      res.should.have.status(422);
      res.body.success.should.equal(false);
    });

    it('should return error with invalid reservation permlink', async () => {
      const res = await chai.request(app)
        .post('/campaigns-api/validate_reject_reservation')
        .send({
          campaign_permlink: campaign_permlink1,
          user_name: 'name1',
          reservation_permlink: 'sss',
          unreservation_permlink: 'unreservation_permlink',
        });

      res.should.have.status(422);
      res.body.success.should.equal(false);
    });

    it('should return error with not exist user in campaign', async () => {
      const res = await chai.request(app)
        .post('/campaigns-api/validate_reject_reservation')
        .send({
          campaign_permlink: campaign_permlink2,
          user_name: 'name1',
          reservation_permlink: 'permlink',
          unreservation_permlink: 'unreservation_permlink',
        });

      res.should.have.status(422);
      res.body.success.should.equal(false);
    });
  });
  describe('validate inactivation /', async () => {
    let active_campaign;
    let pending_campaign;

    beforeEach(async () => {
      await dropDatabase();
      active_campaign = await CampaignFactory.Create({ guideName: 'eugenezh', status: 'active', activation_permlink: 'activation_permlink' });
      pending_campaign = await CampaignFactory.Create({ guideName: 'eugenezh', status: 'pending' });
    });

    it('should return success', async () => {
      const res = await chai.request(app)
        .post('/campaigns-api/validate_inactivation')
        .send({
          campaign_permlink: active_campaign.activation_permlink,
          guide_name: 'eugenezh',
          permlink: 'permlink',
        });

      res.should.have.status(200);
      res.body.result.should.equal(true);
    });

    it('should return error with pending campaign', async () => {
      const res = await chai.request(app)
        .post('/campaigns-api/validate_inactivation')
        .send({ campaign_permlink: pending_campaign.activation_permlink, guide_name: 'eugenezh' });

      res.should.have.status(422);
      res.body.success.should.equal(false);
    });

    it('should return error with invalid campaign permlink', async () => {
      const res = await chai.request(app)
        .post('/campaigns-api/validate_inactivation')
        .send({ campaign_permlink: 'asda', guide_name: 'eugenezh', permlink: 'permlink' });

      res.should.have.status(422);
      res.body.success.should.equal(false);
    });

    it('should return error with invalid guide name', async () => {
      const res = await chai.request(app)
        .post('/campaigns-api/validate_inactivation')
        .send({ campaign_permlink: active_campaign.activation_permlink, guide_name: 'sdsd', permlink: 'permlink' });

      res.should.have.status(422);
      res.body.success.should.equal(false);
    });

    it('should return error withount permlink', async () => {
      const res = await chai.request(app)
        .post('/campaigns-api/validate_inactivation')
        .send({ campaign_permlink: active_campaign.activation_permlink, guide_name: 'eugenezh' });

      res.should.have.status(422);
      res.body.success.should.equal(false);
    });
  });
  describe('getStatistics', async () => {
    let guideName1, guideName2;

    beforeEach(async () => {
      await dropDatabase();
      guideName1 = ' guide1';
      guideName2 = ' guide2';
      await CampaignFactory.Create({ guideName: guideName2, status: 'active' });
      await CampaignFactory.Create({ guideName: guideName2, status: 'inactive' });
      await PaymentHistoryFactory.Create({ sponsor: guideName2 });
      await PaymentHistoryFactory.Create({ userName: guideName2 });
    });
    it('should return success without records', async () => {
      const res = await chai.request(app)
        .post('/campaigns-api/statistics')
        .send({ userName: guideName1 });

      res.should.have.status(200);
      expect(res.body.count_history_campaigns).to.be.eq(0);
      expect(res.body.count_campaigns).to.be.eq(0);
      expect(res.body.has_payable).to.be.false;
      expect(res.body.has_receivable).to.be.false;
    });

    it('should return success with records 1', async () => {
      const res = await chai.request(app).post('/campaigns-api/statistics')
        .send({ userName: guideName2 });

      res.should.have.status(200);
      expect(res.body.count_history_campaigns).to.be.eq(1);
      expect(res.body.count_campaigns).to.be.eq(2);
      expect(res.body.has_payable).to.be.true;
      expect(res.body.has_receivable).to.be.true;
    });

    it('should return success with invalid name', async () => {
      const res = await chai.request(app).post('/campaigns-api/statistics')
        .send({ userName: guideName1 });

      res.should.have.status(200);
      expect(res.body.count_history_campaigns).to.be.eq(0);
      expect(res.body.count_campaigns).to.be.eq(0);
      expect(res.body.has_payable).to.be.false;
      expect(res.body.has_receivable).to.be.false;
    });

    it('should return success with records 2', async () => {
      const res = await chai.request(app).post('/campaigns-api/statistics')
        .send({ userName: guideName2 });

      res.should.have.status(200);
    });
  });
});
describe('blackList', async () => {
  let user, user1, user2;
  beforeEach(async () => {
    await dropDatabase();
    user = await UserFactory.Create({ followers_count: 10, count_posts: 10 });
    user1 = await UserFactory.Create({ followers_count: 10, count_posts: 10 });
    user2 = await UserFactory.Create({ followers_count: 10, count_posts: 10 });
    const campaign = await CampaignFactory.Create({ status: 'active' });
    const secondFollow = await BlacklistFactory.Create({ blackList: [user2.name] });
    const followList = await BlacklistFactory.Create({ blackList: [user1.name], follow: [secondFollow._id] });
    await BlacklistFactory.Create({ user: campaign.guideName, blackList: [user.name], follow: [followList._id] });
  });
  it('should not return campaign if user in guide blackList', async () => {
    const result = await chai.request(app)
      .post('/campaigns-api/campaigns/eligible')
      .send({ userName: user.name });
    expect(result.body.campaigns).to.have.length(0);
  });
  it('should not return campaign if user in guide follows blackList', async () => {
    const result = await chai.request(app)
      .post('/campaigns-api/campaigns/eligible')
      .send({ userName: user1.name });
    expect(result.body.campaigns).to.have.length(0);
  });
  it('should not return campaign if user in guide follows user follows blackList', async () => {
    const result = await chai.request(app)
      .post('/campaigns-api/campaigns/eligible')
      .send({ userName: user2.name });
    expect(result.body.campaigns).to.have.length(0);
  });
});
describe('eligible: if have received a reward from campaign in the last frequency_assign days', async () => {
  let user, wobject;
  beforeEach(async () => {
    await dropDatabase();

    const frequency = _.random(1, 30);
    user = await UserFactory.Create({ followers_count: 10, count_posts: 10 });
    wobject = await WobjectFactory.Create();
    const users = [];
    for (let i = 0; i < _.random(2, 5); i++) {
      let time = moment().subtract(frequency * (i + 1), 'days').toISOString();
      if (!i) time = moment().subtract((frequency - 1) * (i + 1), 'days').toISOString();
      users.push({
        name: user.name,
        object_permlink: faker.random.string(),
        permlink: faker.random.string(),
        hiveCurrency: 1,
        status: 'completed',
        updatedAt: time,
        createdAt: time,
      });
    }

    await CampaignFactory.Create({
      status: 'active',
      frequency_assign: frequency,
      requiredObject: wobject.author_permlink,
      users,
      customTimestamps : true,
    });
  });
  it('expect campaigns length to be 0', async () => {
    const { body: { campaigns } } = await chai.request(app)
      .post('/campaigns-api/campaigns/eligible')
      .send({ userName: user.name, requiredObject: wobject.author_permlink });
    expect(campaigns).to.have.length(0);
  });
});
describe('eligible: if have not received a reward from campaign in the last frequency_assign days', async () => {
  let user, wobject;
  beforeEach(async () => {
    await dropDatabase();

    const frequency = _.random(1, 30);
    user = await UserFactory.Create({ followers_count: 10, count_posts: 10 });
    wobject = await WobjectFactory.Create();
    const users = [];
    for (let i = 0; i < _.random(2, 5); i++) {
      const time = moment().subtract(frequency * (i + 1), 'days').toISOString();
      users.push({
        name: user.name,
        object_permlink: faker.random.string(),
        permlink: faker.random.string(),
        hiveCurrency: 1,
        status: 'completed',
        updatedAt: time,
        createdAt: time,
      });
    }

    await CampaignFactory.Create({
      status: 'active',
      frequency_assign: frequency,
      requiredObject: wobject.author_permlink,
      users,
      customTimestamps : true,
    });
  });
  it('expect campaigns length to be 1', async () => {
    const { body: { campaigns } } = await chai.request(app)
      .post('/campaigns-api/campaigns/eligible')
      .send({ userName: user.name, requiredObject: wobject.author_permlink });
    expect(campaigns).to.have.length(1);
  });
});
describe('route /campaigns-api/rewards/:userName', async () => {
  let user, campaign, wobject;
  beforeEach(async () => {
    await dropDatabase();
    wobject = await WobjectFactory.Create();
    campaign = await CampaignFactory.Create({
      status: 'active', requiredObject: wobject.author_permlink,
    });
    user = await UserFactory.Create({
      name: faker.name.firstName(),
      count_posts: 2,
      followers_count: 2,
    });
  });

  it('valid request with valid name should return 200', async () => {
    const res = await chai.request(app).get(`/campaigns-api/rewards/${user.name}`);
    res.should.have.status(200);
  });

  it('if user follows campaign requiredObject he should see campaign in feed', async () => {
    user = await UserFactory.Create({
      name: faker.name.firstName(),
      count_posts: 2,
      followers_count: 2,
    });
    await WobjectSubscriptionFactory
      .Create({ follower: user.name, following: campaign.requiredObject });
    const { body: { campaigns: [returnedCampaign] } } = await chai.request(app).get(`/campaigns-api/rewards/${user.name}`);
    expect(returnedCampaign).to.be.exist;
  });

  it('if user follows campaign guide he should see campaign in feed', async () => {
    await SubscriptionFactory.Create({ follower: user.name, following: campaign.guideName });
    const { body: { campaigns: [returnedCampaign] } } = await chai.request(app).get(`/campaigns-api/rewards/${user.name}`);
    expect(returnedCampaign).to.be.exist;
  });

  it('if user does not follows either campaign guide or campaign requiredObject - the campaign will not be shown ', async () => {
    const { body: { campaigns: [returnedCampaign] } } = await chai.request(app).get(`/campaigns-api/rewards/${user.name}`);
    expect(returnedCampaign).to.be.undefined;
  });

  describe('on route /campaign/review-check/:campaignId', async () => {
    let campaign, users, primaryObject, secondaryObject, userName, sponsor, alias, payments, postPermlink, spy;
    describe('when send userName without postPermlink', async () => {
      beforeEach(async () => {
        await dropDatabase();
        alias = faker.name.firstName();
        userName = faker.name.firstName();
        primaryObject = await WobjectFactory.Create();
        secondaryObject = await WobjectFactory.Create();
        sponsor = await UserFactory.Create({ alias });
        users = [{
          name: userName,
          status: 'assigned',
          object_permlink: secondaryObject.author_permlink,
          hiveCurrency: 1,
          rewardRaisedBy: 0,
          permlink: faker.random.string(),
          _id: new ObjectID(),
        }];
        campaign = await CampaignFactory.Create({
          requiredObject: primaryObject.author_permlink,
          users,
          guideName: sponsor.name,
          app: faker.random.string(),
          objects: [secondaryObject.author_permlink],
        });
      });
      it('should return status code 200', async () => {
        const res = await chai.request(app).get(`/campaigns-api/campaign/review-check/${campaign._id}`)
          .query({ userName });
        expect(res).to.have.status(200);
      });
      it('should return status code 422', async () => {
        const res = await chai.request(app).get(`/campaigns-api/campaign/review-check/${campaign._id}`);
        expect(res).to.have.status(422);
      });
      it('should return status code 404', async () => {
        const res = await chai.request(app).get(`/campaigns-api/campaign/review-check/${faker.random.string()}`)
          .query({ userName });
        expect(res).to.have.status(404);
      });
      it('alias should be same', async () => {
        ({ body: { campaign } } = await chai.request(app).get(`/campaigns-api/campaign/review-check/${campaign._id}`)
          .query({ userName }));
        expect(campaign.alias).to.be.eq(alias);
      });
      it('response should have requiredObject', async () => {
        const wobjFields = {
          author_permlink: primaryObject.author_permlink,
          name: primaryObject.default_name,
          object_type: primaryObject.object_type,
        };
        ({ body: { campaign } } = await chai.request(app).get(`/campaigns-api/campaign/review-check/${campaign._id}`)
          .query({ userName }));
        expect(campaign.requiredObject).to.be.deep.eq(wobjFields);
      });
      it('response should have secondaryObject', async () => {
        const wobjFields = {
          author_permlink: secondaryObject.author_permlink,
          name: secondaryObject.default_name,
          object_type: secondaryObject.object_type,
        };
        ({ body: { campaign } } = await chai.request(app).get(`/campaigns-api/campaign/review-check/${campaign._id}`)
          .query({ userName }));
        expect(campaign.secondaryObject).to.be.deep.eq(wobjFields);
      });
    });
    describe('when send userName and postPermlink', async () => {
      beforeEach(async () => {
        await dropDatabase();
        alias = faker.name.firstName();
        userName = faker.name.firstName();
        postPermlink = faker.random.string();
        primaryObject = await WobjectFactory.Create();
        secondaryObject = await WobjectFactory.Create();
        sponsor = await UserFactory.Create({ alias });
        sinon.spy(render, 'renderSuccess');

        payments = [{
          objectPermlink: secondaryObject.author_permlink,
          reservationId: new ObjectID(),
          userName,
          rootAuthor: userName,
          postTitle: faker.random.string(),
          postPermlink,
        }];
        campaign = await CampaignFactory.Create({
          requiredObject: primaryObject.author_permlink,
          payments,
          guideName: sponsor.name,
          app: faker.random.string(),
          objects: [secondaryObject.author_permlink],
        });
      });
      afterEach(() => {
        sinon.restore();
      });
      it('should return status code 200', async () => {
        const res = await chai.request(app).get(`/campaigns-api/campaign/review-check/${campaign._id}`)
          .query({ userName, postPermlink });
        expect(res).to.have.status(200);
      });
      it('should return status code 422', async () => {
        const res = await chai.request(app).get(`/campaigns-api/campaign/review-check/${campaign._id}`)
          .query({ postPermlink });
        expect(res).to.have.status(422);
      });
      it('should return status code 404', async () => {
        const res = await chai.request(app).get(`/campaigns-api/campaign/review-check/${faker.random.string()}`)
          .query({ userName, postPermlink });
        expect(res).to.have.status(404);
      });
      it('alias should be same', async () => {
        ({ body: { campaign } } = await chai.request(app).get(`/campaigns-api/campaign/review-check/${campaign._id}`)
          .query({ userName, postPermlink }));
        expect(campaign.alias).to.be.eq(alias);
      });
      it('response should have requiredObject', async () => {
        const wobjFields = {
          author_permlink: primaryObject.author_permlink,
          name: primaryObject.default_name,
          object_type: primaryObject.object_type,
        };
        ({ body: { campaign } } = await chai.request(app).get(`/campaigns-api/campaign/review-check/${campaign._id}`)
          .query({ userName, postPermlink }));
        expect(campaign.requiredObject).to.be.deep.eq(wobjFields);
      });
      it('response should have secondaryObject', async () => {
        const wobjFields = {
          author_permlink: secondaryObject.author_permlink,
          name: secondaryObject.default_name,
          object_type: secondaryObject.object_type,
        };
        ({ body: { campaign } } = await chai.request(app).get(`/campaigns-api/campaign/review-check/${campaign._id}`)
          .query({ userName, postPermlink }));
        expect(campaign.secondaryObject).to.be.deep.eq(wobjFields);
      });
      it('should not call renderSuccess on code 404', async () => {
        await chai.request(app).get(`/campaigns-api/campaign/review-check/${faker.random.string()}`);
        expect(render.renderSuccess.notCalled).to.be.true;
      });
    });
  });

  describe('On /campaigns/reserved/count', async () => {
    let result;
    const userName = faker.random.string(20)
    const count = _.random(5, 10)
    beforeEach(async () => {
      for (let i = 0; i < count; i++) {
        await CampaignFactory.Create({
          users: [{
            name: userName,
            status: RESERVATION_STATUSES.ASSIGNED,
            object_permlink: faker.random.string(20),
            hiveCurrency:  1,
            rewardRaisedBy:  0,
            permlink: faker.random.string(20),
            _id: new ObjectID(),
          }],
          status: _.sample([CAMPAIGN_STATUSES.ACTIVE, CAMPAIGN_STATUSES.ON_HOLD])
        });
      }
    });
    describe('On ok', async () => {
      beforeEach(async () => {
        result = await chai.request(app).get(`/campaigns-api/campaigns/reserved/count`).query({userName});
      });

      it('should return write count', async () => {
        expect(result.body.count).to.be.eq(count);
      });

      it('should status be 200', async () => {
        expect(result).to.have.status(200);
      });
    });

    describe('On errors', async () => {
      it('should return 422 when no user name in query', async () => {
        result = await chai.request(app).get(`/campaigns-api/campaigns/reserved/count`);
        expect(result).to.have.status(422);
      });

      it('should return 0 counter when user he has no companies reserved', async () => {
        result = await chai.request(app)
          .get(`/campaigns-api/campaigns/reserved/count`)
          .query({userName: faker.random.string()});
        expect(result.body.count).to.be.eq(0);
      });
    });
  });
});
