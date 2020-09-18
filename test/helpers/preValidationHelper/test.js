const rewire = require('rewire');

const preValidationHelperModule = rewire('utilities/helpers/preValidationHelper');
const countReservationDays = preValidationHelperModule.__get__('countReservationDays');
const checkReserveInSameCampaigns = preValidationHelperModule.__get__('checkReserveInSameCampaigns');
const {
  preValidationHelper, dropDatabase, expect, moment, faker, _,
  currencyRequest, sinon, campaignActivation, reservationOps,
} = require('test/testHelper');
const { UserFactory, CampaignFactory, WobjectFactory } = require('test/factories');

describe('preValidationHelper', async () => {
  describe('validateActivation', async () => {
    beforeEach(async () => {
      await dropDatabase();
    });
    it('should return true with all valid data', async () => {
      const newCampaign = await CampaignFactory.Create({
        guideName: 'eugenezh', status: 'pending', budget: 1.1, reward: 1,
      });

      const { is_valid, campaign } = await preValidationHelper.validateActivation({ campaign_id: newCampaign._id, guide_name: 'eugenezh', permlink: 'permlink' });

      expect(is_valid).to.be.true;
      expect(campaign).to.be.exist;
    });

    it('should not activate campaign with not unique permlink', async () => {
      const newCampaign1 = await CampaignFactory.Create({
        guideName: 'eugenezh', status: 'pending', budget: 1.1, reward: 1,
      });
      const newCampaign2 = await CampaignFactory.Create({
        guideName: 'eugenezh', status: 'pending', budget: 1.1, reward: 1,
      });

      await campaignActivation.activate(newCampaign1._id, 'eugenezh', 'permlink');
      const { is_valid, message } = await preValidationHelper.validateActivation({ campaign_id: newCampaign2._id, guide_name: 'eugenezh', permlink: 'permlink' });

      expect(is_valid).to.be.false;
      expect(message).to.be.eq('Permlink not unique');
    });

    it('should return false with invalid expiration time( < (time_now + 1 day))', async () => {
      const newCampaign = await CampaignFactory.Create({
        guideName: 'eugenezh', status: 'pending', budget: 1.1, reward: 1, expired_at: new Date(),
      });

      const { is_valid, message } = await preValidationHelper.validateActivation({ campaign_id: newCampaign._id, guide_name: 'eugenezh', permlink: Math.random().toString(36) });

      expect(is_valid).to.be.false;
      expect(message).to.be.eq('Expiration time is invalid');
    });

    it('should return false without guide name', async () => {
      const newCampaign = await CampaignFactory.Create({
        guideName: 'eugenezh', status: 'pending', budget: 1.1, reward: 1,
      });

      const { is_valid, message } = await preValidationHelper.validateActivation({ campaign_id: newCampaign._id, guide_name: null, permlink: Math.random().toString(36) });

      expect(is_valid).to.be.false;
      expect(message).to.be.eq('Invalid campaign_id or activation permlink. Campaign status must be pending');
    });

    it('should return false without permlink', async () => {
      const newCampaign = await CampaignFactory.Create({
        guideName: 'eugenezh', status: 'pending', budget: 1.1, reward: 1,
      });

      const { is_valid, message } = await preValidationHelper.validateActivation({ campaign_id: newCampaign._id, guide_name: 'eugenezh' });

      expect(is_valid).to.be.false;
      expect(message).to.be.eq('Invalid campaign_id or activation permlink. Campaign status must be pending');
    });

    it('should return false with invalid guide name', async () => {
      const newCampaign = await CampaignFactory.Create({
        guideName: 'eugenezh', status: 'pending', budget: 1.1, reward: 1,
      });

      const { is_valid, message } = await preValidationHelper.validateActivation({ campaign_id: newCampaign._id, guide_name: 'eugenezhasdasd', permlink: Math.random().toString(36) });

      expect(is_valid).to.be.false;
      expect(message).to.be.eq('Invalid campaign_id or activation permlink. Campaign status must be pending');
    });

    it('should return false with non pending status', async () => {
      const newCampaign = await CampaignFactory.Create({
        guideName: 'eugenezh', status: 'payed', budget: 1.1, reward: 1,
      });

      const { is_valid, message } = await preValidationHelper.validateActivation({ campaign_id: newCampaign._id, guide_name: 'eugenezh', permlink: 'permlink' });

      expect(is_valid).to.be.false;
      expect(message).to.be.eq('Invalid campaign_id or activation permlink. Campaign status must be pending');
    });
  });
  describe('validateReservation', async () => {
    let days;
    const campaign_permlink1 = 'campaign_permlink1';
    const campaign_permlink2 = 'campaign_permlink2';
    const campaign_permlink3 = 'campaign_permlink3';
    const campaign_permlink4 = 'campaign_permlink4';
    const campaign_permlink5 = 'campaign_permlink5';
    const currentDay = new Date().getDay();

    beforeEach(async () => {
      await dropDatabase();
      days = {
        monday: true,
        tuesday: true,
        wednesday: true,
        thursday: true,
        friday: true,
        saturday: true,
        sunday: true,
      };
      await UserFactory.Create({ name: 'name1' });
      sinon.stub(currencyRequest, 'getHiveCurrency').returns(Promise.resolve({ usdCurrency: 1 }));
      await WobjectFactory.Create({ author_permlink: 'obj1', coordinates: [20, 30], objects: ['obj1', 'obj2'] });
      await WobjectFactory.Create({ author_permlink: 'obj2', coordinates: [20, 30] });
      await CampaignFactory.Create({
        status: 'active', requiredObject: 'obj1', users: [], activation_permlink: campaign_permlink1,
      });
      await CampaignFactory.Create({
        status: 'pending', requiredObject: 'obj2', users: [], activation_permlink: campaign_permlink2,
      });
    });
    afterEach(async () => {
      sinon.restore();
    });

    it('should add user to active campaign', async () => {
      const { is_valid, campaign } = await preValidationHelper.validateAssign({
        campaign_permlink: campaign_permlink1, user_name: 'name1', approved_object: 'obj1', reservation_permlink: 'permlink1',
      });
      expect(is_valid).to.be.true;
      expect(campaign).to.be.exist;
    });

    it('check count reservation days by default', async () => {
      const { limit_reservation_days: limitReservationDays, is_valid } = await preValidationHelper.validateAssign({
        campaign_permlink: campaign_permlink1, user_name: 'name1', approved_object: 'obj1', reservation_permlink: 'permlink1',
      });
      expect(is_valid).to.be.true;
      expect(limitReservationDays).to.be.eq(1);
    });

    it('check count reservation days by custom value', async () => {
      await CampaignFactory.Create({
        status: 'active',
        requiredObject: 'obj1',
        users: [],
        reservation_timetable: days,
        count_reservation_days: 5,
        activation_permlink: campaign_permlink3,
      });
      const { limit_reservation_days: limitReservationDays, is_valid } = await preValidationHelper.validateAssign({
        campaign_permlink: campaign_permlink3, user_name: 'name1', approved_object: 'obj1', reservation_permlink: 'permlink1',
      });

      expect(is_valid).to.be.true;
      expect(limitReservationDays).to.be.eq(5);
    });

    it('check count reservation if current day is not allow to reserve', async () => {
      days[Object.keys(days)[(currentDay === 0 ? 7 : currentDay) - 1]] = false;
      await CampaignFactory.Create({
        status: 'active',
        requiredObject: 'obj1',
        users: [],
        reservation_timetable: days,
        count_reservation_days: 5,
        activation_permlink: campaign_permlink4,
      });

      const { is_valid, message } = await preValidationHelper.validateAssign({
        campaign_permlink: campaign_permlink4, user_name: 'name1', approved_object: 'obj1', reservation_permlink: 'permlink1',
      });

      expect(is_valid).to.be.false;
      expect(message).to.be.eq('Today can not reservation');
    });

    it('check count reservation with limit by days', async () => {
      days[Object.keys(days)[currentDay === 6 ? 0 : currentDay + 1]] = false;
      await CampaignFactory.Create({
        status: 'active',
        requiredObject: 'obj1',
        users: [],
        reservation_timetable: days,
        count_reservation_days: 5,
        activation_permlink: campaign_permlink5,
      });
      const { limit_reservation_days: limitReservationDays, is_valid } = await preValidationHelper.validateAssign({
        campaign_permlink: campaign_permlink5, user_name: 'name1', approved_object: 'obj1', reservation_permlink: 'permlink1',
      });

      expect(is_valid).to.be.true;
      expect(limitReservationDays).to.be.eq(2);
    });

    it('should add user to active campaign with the same budget and reward', async () => {
      await CampaignFactory.Create({
        budget: 1, reward: 1, status: 'active', requiredObject: 'obj1', users: [], activation_permlink: 'same_budget_reward',
      });
      const { is_valid, campaign } = await preValidationHelper.validateAssign({
        campaign_permlink: 'same_budget_reward', user_name: 'name1', approved_object: 'obj1', reservation_permlink: 'permlink1', users: [],
      });

      expect(is_valid).to.be.true;
      expect(campaign).to.be.exist;
    });

    it('should not add user to active campaign with limit assign', async () => {
      for (let i = 0; i < 9; i++) {
        await UserFactory.Create({ name: `name1${i}` });
        await reservationOps.assign({
          campaign_permlink: campaign_permlink1, user_name: `name1${i}`, approved_object: 'obj1', reservation_permlink: `permlink${i}`,
        });
      }
      const { is_valid, message } = await preValidationHelper.validateAssign({
        campaign_permlink: campaign_permlink1, user_name: 'name1', approved_object: 'obj1', reservation_permlink: 'permlink',
      });

      expect(is_valid).to.be.false;
      expect(message).to.be.eq('Reserve exceeded by budget');
    });

    it('should not add the same assigned user and another object', async () => {
      await reservationOps.assign({
        campaign_permlink: campaign_permlink1, user_name: 'name1', approved_object: 'obj1', reservation_permlink: 'permlink1',
      });
      const { is_valid, message } = await preValidationHelper.validateAssign({
        campaign_permlink: campaign_permlink1, user_name: 'name1', approved_object: 'obj2', reservation_permlink: 'permlink2',
      });

      expect(is_valid).to.be.false;
      expect(message).to.be.eq('Reservation is exist');
    });

    it('should not add with not unique assign permlink', async () => {
      await CampaignFactory.Create({
        budget: 1, reward: 1, status: 'active', requiredObject: 'obj1', users: [], activation_permlink: 'another_permlink',
      });
      await reservationOps.assign({
        campaign_permlink: 'another_permlink', user_name: 'name1', approved_object: 'obj1', reservation_permlink: 'permlink1',
      });
      const { is_valid, message } = await preValidationHelper.validateAssign({
        campaign_permlink: campaign_permlink1, user_name: 'name1', approved_object: 'obj2', reservation_permlink: 'permlink1',
      });

      expect(is_valid).to.be.false;
      expect(message).to.be.eq('Reservation permlink not unique');
    });

    it('should not add the same assigned user and same object', async () => {
      await reservationOps.assign({
        campaign_permlink: campaign_permlink1, user_name: 'name1', approved_object: 'obj1', reservation_permlink: 'permlink1',
      });
      const { is_valid, message } = await preValidationHelper.validateAssign({
        campaign_permlink: campaign_permlink1, user_name: 'name1', approved_object: 'obj1', reservation_permlink: 'permlink2',
      });

      expect(is_valid).to.be.false;
      expect(message).to.be.eq('Reservation is exist');
    });

    it('should not add assign object not contains in campaign', async () => {
      const { is_valid, message } = await preValidationHelper.validateAssign({
        campaign_permlink: campaign_permlink1, user_name: 'name1', approved_object: 'obj2d', reservation_permlink: 'permlink',
      });

      expect(is_valid).to.be.false;
      expect(message).to.be.eq('Invalid campaign activation permlink, reservation permlink or invalid user');
    });

    it('should not add user without userName', async () => {
      const { is_valid, message } = await preValidationHelper.validateAssign({ campaign_permlink: campaign_permlink1, approved_object: 'obj1', reservation_permlink: 'permlink1' });

      expect(is_valid).to.be.false;
      expect(message).to.be.eq('Invalid campaign activation permlink, reservation permlink or invalid user');
    });

    it('should not add user without permlink', async () => {
      const { is_valid, message } = await preValidationHelper.validateAssign({ campaign_permlink: campaign_permlink1, approved_object: 'obj1' });

      expect(is_valid).to.be.false;
      expect(message).to.be.eq('Invalid campaign activation permlink, reservation permlink or invalid user');
    });

    it('should not add user without campaign permlink', async () => {
      const { is_valid, message } = await preValidationHelper.validateAssign({ user_name: 'name1', approved_object: 'obj1', reservation_permlink: 'permlink1' });

      expect(is_valid).to.be.false;
      expect(message).to.be.eq('Invalid campaign activation permlink, reservation permlink or invalid user');
    });

    it('should not add user without approved_objects', async () => {
      const { is_valid, message } = await preValidationHelper.validateAssign({ campaign_permlink: campaign_permlink1, user_name: 'name1', reservation_permlink: 'permlink1' });

      expect(is_valid).to.be.false;
      expect(message).to.be.eq('Invalid campaign activation permlink, reservation permlink or invalid user');
    });

    it('should not add user with invalid approved_objects', async () => {
      const { is_valid, message } = await preValidationHelper.validateAssign({
        campaign_permlink: campaign_permlink1, user_name: 'name1', approved_object: 'obj1dsfds', reservation_permlink: 'permlink1',
      });

      expect(is_valid).to.be.false;
      expect(message).to.be.eq('Invalid campaign activation permlink, reservation permlink or invalid user');
    });

    it('should not add user with empty approved_objects', async () => {
      const { is_valid, message } = await preValidationHelper.validateAssign({
        campaign_permlink: campaign_permlink1, user_name: 'name1', approved_object: '', reservation_permlink: 'permlink1',
      });

      expect(is_valid).to.be.false;
      expect(message).to.be.eq('Invalid campaign activation permlink, reservation permlink or invalid user');
    });

    it('should not add user to pending campaign', async () => {
      const { is_valid, message } = await preValidationHelper.validateAssign({
        campaign_permlink: campaign_permlink2, user_name: 'name1', approved_object: 'obj1', reservation_permlink: 'permlink1',
      });

      expect(is_valid).to.be.false;
      expect(message).to.be.eq('Invalid campaign activation permlink, reservation permlink or invalid user');
    });
    describe('checkReserveInSameCampaigns', async () => {
      const permlink1 = 'activation_permlink1';
      const permlink2 = 'activation_permlink2';

      beforeEach(async () => {
        await dropDatabase();
        await UserFactory.Create({ name: 'user1' });
        await UserFactory.Create({ name: 'user2' });
        await UserFactory.Create({ name: 'user3' });
        await CampaignFactory.Create({
          guideName: 'guide1',
          status: 'active',
          requiredObject: 'obj1',
          users: [
            {
              name: 'user1',
              object_permlink: 'obj1',
              permlink: faker.random.number(),
              status: 'assigned',
              createdAt: new Date(),
              hiveCurrency: 1,
            },
            {
              name: 'user2',
              object_permlink: 'obj1',
              permlink: faker.random.number(),
              status: 'unassigned',
              createdAt: new Date(),
              hiveCurrency: 1,
            },
          ],
          activation_permlink: permlink1,
        });
      });

      it('check without same campaigns', async () => {
        const { is_valid } = await preValidationHelper.validateAssign({
          campaign_permlink: permlink1, user_name: 'user2', approved_object: 'obj1', reservation_permlink: faker.random.number(),
        });

        expect(is_valid).to.be.true;
      });

      it('check with same campaigns by only guideName', async () => {
        await CampaignFactory.Create({
          guideName: 'guide1',
          status: 'active',
          requiredObject: 'obj2',
          users: [
            {
              name: 'user3',
              object_permlink: 'obj1',
              permlink: faker.random.number(),
              status: 'assigned',
              createdAt: new Date(),
              hiveCurrency: 1,
            },
          ],
          activation_permlink: permlink2,
        });
        const { is_valid } = await preValidationHelper.validateAssign({
          campaign_permlink: permlink1, user_name: 'user2', approved_object: 'obj1', reservation_permlink: faker.random.number(),
        });

        expect(is_valid).to.be.true;
      });

      it('check with same campaigns by only guideName and main object', async () => {
        await CampaignFactory.Create({
          guideName: 'guide1',
          status: 'active',
          requiredObject: 'obj1',
          users: [
            {
              name: 'user3',
              object_permlink: 'obj1',
              permlink: faker.random.number(),
              status: 'assigned',
              createdAt: new Date(),
              hiveCurrency: 1,
            },
          ],
          activation_permlink: permlink2,
        });
        const { is_valid } = await preValidationHelper.validateAssign({
          campaign_permlink: permlink1, user_name: 'user2', approved_object: 'obj1', reservation_permlink: faker.random.number(),
        });

        expect(is_valid).to.be.true;
      });

      it('check with same campaigns by only guideName and main object and user( status not assigned )', async () => {
        const { is_valid } = await preValidationHelper.validateAssign({
          campaign_permlink: permlink1, user_name: 'user2', approved_object: 'obj1', reservation_permlink: faker.random.number(),
        });

        expect(is_valid).to.be.true;
      });

      it('check with same campaigns by guideName and main object and user( status is assigned )', async () => {
        await CampaignFactory.Create({
          guideName: 'guide1',
          status: 'active',
          requiredObject: 'obj1',
          users: [
            {
              name: 'user2',
              object_permlink: 'obj1',
              permlink: faker.random.number(),
              status: 'assigned',
              createdAt: new Date(),
              hiveCurrency: 1,
            },
          ],
          activation_permlink: permlink2,
        });
        const { is_valid, message } = await preValidationHelper.validateAssign({
          campaign_permlink: permlink2, user_name: 'user1', approved_object: 'obj1', reservation_permlink: faker.random.number(),
        });

        expect(is_valid).to.be.false;
        expect(message).to.be.eq('Reservation in this main object is exist');
      });
    });
    describe('checkFrequencyReservation', async () => {
      const permlink1 = 'activation_permlink1';

      beforeEach(async () => {
        await dropDatabase();
        await UserFactory.Create({ name: 'user1' });
      });

      it('check without completed reservations', async () => {
        await CampaignFactory.Create({
          guideName: 'guide1',
          status: 'active',
          requiredObject: 'obj1',
          users: [{
            name: 'user2',
            object_permlink: 'obj1',
            permlink: faker.random.number(),
            status: 'assigned',
            createdAt: new Date(),
            hiveCurrency: 1,

          },
          ],
          activation_permlink: permlink1,
        });
        const { is_valid } = await preValidationHelper.validateAssign({
          campaign_permlink: permlink1, user_name: 'user1', approved_object: 'obj1', reservation_permlink: faker.random.number(),
        });

        expect(is_valid).to.be.true;
      });

      it('check with completed createdAt == ( Date now - frequency assign days )', async () => {
        await CampaignFactory.Create({
          guideName: 'guide1',
          status: 'active',
          requiredObject: 'obj1',
          frequency_assign: 5,
          max_assign_count: 4,
          users: [
            {
              name: 'user1',
              object_permlink: 'obj1',
              permlink: faker.random.number(),
              status: 'completed',
              createdAt: moment().subtract(5, 'days'),
              hiveCurrency: 1,
            },
          ],
          activation_permlink: permlink1,
        });
        const { is_valid } = await preValidationHelper.validateAssign({
          campaign_permlink: permlink1, user_name: 'user1', approved_object: 'obj1', reservation_permlink: faker.random.number(),
        });

        expect(is_valid).to.be.true;
      });

      it('check with completed createdAt > ( Date now - frequency assign days )', async () => {
        await CampaignFactory.Create({
          guideName: 'guide1',
          status: 'active',
          requiredObject: 'obj1',
          frequency_assign: 5,
          max_assign_count: 4,
          users: [
            {
              name: 'user1',
              object_permlink: 'obj1',
              permlink: faker.random.number(),
              status: 'completed',
              createdAt: moment().subtract(5, 'days').add(15, 'seconds'),
              hiveCurrency: 1,
            },
          ],
          activation_permlink: permlink1,
        });
        const { is_valid, message } = await preValidationHelper.validateAssign({
          campaign_permlink: permlink1, user_name: 'user1', approved_object: 'obj1', reservation_permlink: faker.random.number(),
        });

        expect(is_valid).to.be.false;
        expect(message).to.be.eq('Reservation frequency is exeeded');
      });

      it('check with completed createdAt < ( Date now - frequency assign days )', async () => {
        await CampaignFactory.Create({
          guideName: 'guide1',
          status: 'active',
          requiredObject: 'obj1',
          frequency_assign: 5,
          max_assign_count: 4,
          users: [
            {
              name: 'user1',
              object_permlink: 'obj1',
              permlink: faker.random.number(),
              status: 'completed',
              createdAt: moment().subtract(7, 'days'),
              hiveCurrency: 1,
            },
          ],
          activation_permlink: permlink1,
        });
        const { is_valid } = await preValidationHelper.validateAssign({
          campaign_permlink: permlink1, user_name: 'user1', approved_object: 'obj1', reservation_permlink: faker.random.number(),
        });

        expect(is_valid).to.be.true;
      });

      it('check with many completed with all expired by frequency', async () => {
        await CampaignFactory.Create({
          guideName: 'guide1',
          status: 'active',
          requiredObject: 'obj1',
          max_assign_count: 4,
          frequency_assign: 5,
          users: [
            {
              name: 'user1',
              object_permlink: 'obj1',
              permlink: faker.random.number(),
              status: 'completed',
              createdAt: moment().subtract(13, 'days'),
              hiveCurrency: 1,
            },
            {
              name: 'user1',
              object_permlink: 'obj1',
              permlink: faker.random.number(),
              status: 'completed',
              createdAt: moment().subtract(11, 'days'),
              hiveCurrency: 1,
            },
            {
              name: 'user1',
              object_permlink: 'obj1',
              permlink: faker.random.number(),
              status: 'completed',
              createdAt: moment().subtract(8, 'days'),
              hiveCurrency: 1,
            },
          ],
          activation_permlink: permlink1,
        });
        const { is_valid } = await preValidationHelper.validateAssign({
          campaign_permlink: permlink1, user_name: 'user1', approved_object: 'obj1', reservation_permlink: faker.random.number(),
        });

        expect(is_valid).to.be.true;
      });
    });
  });
  describe('validateRejectReservation', async () => {
    const campaign_permlink1 = 'campaign_permlink1';
    const campaign_permlink2 = 'campaign_permlink2';

    beforeEach(async () => {
      await dropDatabase();
      sinon.stub(currencyRequest, 'getHiveCurrency').returns(Promise.resolve({ usdCurrency: 1 }));

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
    afterEach(async () => {
      sinon.restore();
    });

    it('should return true', async () => {
      await reservationOps.assign({
        campaign_permlink: campaign_permlink1, user_name: 'name1', approved_object: 'obj1', reservation_permlink: 'permlink1',
      });
      const { is_valid } = await preValidationHelper.validateRejectAssign({
        campaign_permlink: campaign_permlink1,
        user_name: 'name1',
        reservation_permlink: 'permlink1',
        unreservation_permlink: 'unreservation_permlink',
      });

      expect(is_valid).to.be.true;
    });

    it('should return false without unreservation permlink', async () => {
      await reservationOps.assign({
        campaign_permlink: campaign_permlink1, user_name: 'name1', approved_object: 'obj1', reservation_permlink: 'permlink1',
      });
      const { is_valid } = await preValidationHelper.validateRejectAssign({
        campaign_permlink: campaign_permlink1,
        user_name: 'name1',
        reservation_permlink: 'permlink1',
      });

      expect(is_valid).to.be.false;
    });

    it('should return false with not unique unreservation permlink', async () => {
      const some_activation_permlink = 'some_activation_permlink';

      await CampaignFactory.Create({
        status: 'active',
        requiredObject: 'obj1',
        users: [{
          name: 'some_name',
          object_permlink: 'obj2',
          permlink: 'something',
          status: 'unassigned',
          unreservation_permlink: 'unreservation_permlink',
          hiveCurrency: 1,
        }],
        activation_permlink: 'some_activation_permlink',
      });
      await reservationOps.assign({
        campaign_permlink: some_activation_permlink, user_name: 'name1', approved_object: 'obj1', reservation_permlink: 'some_reservation_permlink',
      });
      const { is_valid, message } = await preValidationHelper.validateRejectAssign({
        campaign_permlink: some_activation_permlink,
        user_name: 'name1',
        reservation_permlink: 'some_reservation_permlink',
        unreservation_permlink: 'unreservation_permlink',
      });

      expect(is_valid).to.be.false;
      expect(message).to.be.eq('Uneservation permlink not unique');
    });

    it('should not remove object from user with another permlink', async () => {
      await reservationOps.assign({
        campaign_permlink: campaign_permlink1, user_name: 'name1', approved_object: 'obj1', reservation_permlink: 'permlink1',
      });
      const { is_valid } = await preValidationHelper.validateRejectAssign({
        campaign_permlink: campaign_permlink1,
        user_name: 'name1',
        reservation_permlink: 'asd',
        unreservation_permlink: 'unreservation_permlink',
      });

      expect(is_valid).to.be.false;
    });

    it('should not remove object from user with another username', async () => {
      await reservationOps.assign({
        campaign_permlink: campaign_permlink1, user_name: 'name1', approved_object: 'obj1', reservation_permlink: 'permlink1',
      });
      const { is_valid } = await preValidationHelper.validateRejectAssign({
        campaign_permlink: campaign_permlink1,
        user_name: 'name2',
        reservation_permlink: 'permlink1',
        unreservation_permlink: 'unreservation_permlink',
      });

      expect(is_valid).to.be.false;
    });

    it('should not remove object from user with another campaign permlink', async () => {
      await reservationOps.assign({
        campaign_permlink: campaign_permlink1, user_name: 'name1', approved_object: 'obj1', reservation_permlink: 'permlink1',
      });
      const { is_valid } = await preValidationHelper.validateRejectAssign({
        campaign_permlink: 'asdw',
        user_name: 'name1',
        reservation_permlink: 'permlink1',
        unreservation_permlink: 'unreservation_permlink',
      });

      expect(is_valid).to.be.false;
    });

    it('should not remove object from user with rejected status', async () => {
      await reservationOps.assign({
        campaign_permlink: campaign_permlink1, user_name: 'name1', approved_object: 'obj1', reservation_permlink: 'permlink1',
      });
      await reservationOps.reject({
        campaign_permlink: 'campaign_permlink1', user_name: 'name1', reservation_permlink: 'permlink1', unreservation_permlink: 'unreservation_permlink',
      });
      const { is_valid } = await preValidationHelper.validateRejectAssign({
        campaign_permlink: 'campaign_permlink1',
        user_name: 'name1',
        approved_object: 'obj1',
        reservation_permlink: 'permlink1',
        unreservation_permlink: 'unreservation_permlink',
      });

      expect(is_valid).to.be.false;
    });
  });
  describe('validateInactivation', async () => {
    let active_campaign;
    let pending_campaign;

    beforeEach(async () => {
      await dropDatabase();
      active_campaign = await CampaignFactory.Create({ guideName: 'eugenezh', status: 'active', activation_permlink: 'activation_permlink' });
      pending_campaign = await CampaignFactory.Create({ guideName: 'eugenezh', status: 'pending' });
    });

    it('should inactivate active campaign', async () => {
      const { is_valid, campaign } = await preValidationHelper.validateInactivation({ campaign_permlink: active_campaign.activation_permlink, guide_name: 'eugenezh', permlink: 'permlink' });

      expect(is_valid).to.be.true;
      expect(campaign).to.be.exist;
    });

    it('should not inactivate not active campaign', async () => {
      const { is_valid } = await preValidationHelper.validateInactivation({ campaign_permlink: pending_campaign.activation_permlink, guide_name: 'eugenezh', permlink: 'permlink' });

      expect(is_valid).to.be.false;
    });

    it('should not inactivate with invalid guide name', async () => {
      const { is_valid } = await preValidationHelper.validateInactivation({ campaign_permlink: active_campaign.activation_permlink, guide_name: 'asdasd', permlink: 'permlink' });

      expect(is_valid).to.be.false;
    });

    it('should not inactivate with invalid campaign permlink', async () => {
      const { is_valid } = await preValidationHelper.validateInactivation({ campaign_permlink: 'invalid_permlink', guide_name: 'eugenezh', permlink: 'permlink' });

      expect(is_valid).to.be.false;
    });

    it('should not inactivate without deactivation permlink', async () => {
      const { is_valid } = await preValidationHelper.validateInactivation({ campaign_permlink: active_campaign.activation_permlink, guide_name: 'eugenezh' });

      expect(is_valid).to.be.false;
    });
  });
  describe('checkReservationWeek', async () => {
    let days;
    let campaign;

    beforeEach(() => {
      days = {
        monday: true,
        tuesday: true,
        wednesday: true,
        thursday: true,
        friday: true,
        saturday: true,
        sunday: true,
      };
    });

    it('check with all allow days', async () => {
      campaign = await CampaignFactory.Create({
        status: 'active',
        requiredObject: 'obj1',
        users: [],
        reservation_timetable: days,
        count_reservation_days: 12,
        activation_permlink: 'activation_permlink',
        noObject: true,
      });
      const limitReservationDays = await countReservationDays({
        reservation_timetable: campaign.reservation_timetable,
        count_reservation_days: campaign.count_reservation_days,
      });
      expect(limitReservationDays).to.be.eq(12);
    });

    it('check with current day not allow', async () => {
      const currentDay = new Date().getDay();
      days[Object.keys(days)[(currentDay === 0 ? 7 : currentDay) - 1]] = false;
      campaign = await CampaignFactory.Create({
        status: 'active',
        requiredObject: 'obj1',
        users: [],
        reservation_timetable: days,
        count_reservation_days: 12,
        activation_permlink: 'activation_permlink',
        noObject: true,
      });
      const limitReservationDays = await countReservationDays({
        reservation_timetable: campaign.reservation_timetable,
        count_reservation_days: campaign.count_reservation_days,
      });
      expect(limitReservationDays).to.be.eq(0);
    });

    it('check with next day not allow', async () => {
      const currentDay = new Date().getDay();
      days[Object.keys(days)[currentDay > 6 ? 0 : currentDay]] = false;
      campaign = await CampaignFactory.Create({
        status: 'active',
        requiredObject: 'obj1',
        users: [],
        reservation_timetable: days,
        count_reservation_days: 12,
        activation_permlink: 'activation_permlink',
        noObject: true,
      });
      const limitReservationDays = await countReservationDays({
        reservation_timetable: campaign.reservation_timetable,
        count_reservation_days: campaign.count_reservation_days,
      });
      expect(limitReservationDays).to.be.eq(1);
    });

    it('check with third day not allow', async () => {
      const currentDay = new Date().getDay();
      days[Object.keys(days)[currentDay === 6 ? 0 : currentDay + 1]] = false;
      campaign = await CampaignFactory.Create({
        status: 'active',
        requiredObject: 'obj1',
        users: [],
        reservation_timetable: days,
        count_reservation_days: 12,
        activation_permlink: 'activation_permlink',
        noObject: true,
      });
      const limitReservationDays = await countReservationDays({
        reservation_timetable: campaign.reservation_timetable,
        count_reservation_days: campaign.count_reservation_days,
      });
      expect(limitReservationDays).to.be.eq(2);
    });

    it('check with all days not allow', async () => {
      campaign = await CampaignFactory.Create({
        status: 'active',
        requiredObject: 'obj1',
        users: [],
        reservation_timetable: _.mapValues(days, () => false),
        count_reservation_days: 12,
        activation_permlink: 'activation_permlink',
        noObject: true,
      });
      const limitReservationDays = await countReservationDays({
        reservation_timetable: campaign.reservation_timetable,
        count_reservation_days: campaign.count_reservation_days,
      });
      expect(limitReservationDays).to.be.eq(0);
    });
    it('check with some days day not allow', async () => {
      const currentDay = new Date().getDay();
      days[Object.keys(days)[currentDay === 6 ? 0 : currentDay + 1]] = false;
      days[Object.keys(days)[currentDay + 3]] = false;
      days[Object.keys(days)[currentDay + 5]] = false;
      campaign = await CampaignFactory.Create({
        status: 'active',
        requiredObject: 'obj1',
        users: [],
        reservation_timetable: days,
        count_reservation_days: 12,
        activation_permlink: 'activation_permlink',
        noObject: true,
      });
      const limitReservationDays = await countReservationDays({
        reservation_timetable: campaign.reservation_timetable,
        count_reservation_days: campaign.count_reservation_days,
      });
      expect(limitReservationDays).to.be.eq(2);
    });
  });
  describe('checkReserveInSameCampaigns', async () => {
    beforeEach(async () => {
      await dropDatabase();
    });

    it('check without same campaigns', async () => {
      const result = await checkReserveInSameCampaigns({ campaign: { guideName: 'guide1', requiredObject: 'obj1' }, userName: 'user1' });
      expect(result).to.be.true;
    });
    it('check with same campaigns by only guideName', async () => {
      await CampaignFactory.Create({
        guideName: 'guide1',
        status: 'active',
        requiredObject: 'obj2',
        users: [{
          name: 'user2',
          object_permlink: 'obj1',
          permlink: faker.random.number(),
          status: 'assigned',
          createdAt: new Date(),
          hiveCurrency: 1,
        },
        ],
        activation_permlink: 'activation_permlink1',
      });
      const result = await checkReserveInSameCampaigns({ campaign: { guideName: 'guide1', requiredObject: 'obj1' }, userName: 'user1' });

      expect(result).to.be.true;
    });
    it('check with same campaigns by only guideName and main object', async () => {
      await CampaignFactory.Create({
        guideName: 'guide1',
        status: 'active',
        requiredObject: 'obj1',
        users: [{
          name: 'user2',
          object_permlink: 'obj1',
          permlink: faker.random.number(),
          status: 'assigned',
          createdAt: new Date(),
          hiveCurrency: 1,
        },
        ],
        activation_permlink: 'activation_permlink1',
      });
      const result = await checkReserveInSameCampaigns({ campaign: { guideName: 'guide1', requiredObject: 'obj1' }, userName: 'user1' });
      expect(result).to.be.true;
    });

    it('check with same campaigns by only guideName and main object and user( status not assigned )', async () => {
      await CampaignFactory.Create({
        guideName: 'guide1',
        status: 'active',
        requiredObject: 'obj1',
        users: [{
          name: 'user1',
          object_permlink: 'obj1',
          permlink: faker.random.number(),
          status: 'unassigned',
          createdAt: new Date(),
          hiveCurrency: 1,
        },
        ],
        activation_permlink: 'activation_permlink1',
      });
      const result = await checkReserveInSameCampaigns({ campaign: { guideName: 'guide1', requiredObject: 'obj1' }, userName: 'user1' });
      expect(result).to.be.true;
    });
    it('check with same campaigns by guideName and main object and user( status is assigned )', async () => {
      await CampaignFactory.Create({
        guideName: 'guide1',
        status: 'active',
        requiredObject: 'obj1',
        users: [{
          name: 'user1',
          object_permlink: 'obj1',
          permlink: faker.random.number(),
          status: 'assigned',
          createdAt: new Date(),
          hiveCurrency: 1,
        },
        ],
        activation_permlink: 'activation_permlink1',
      });
      const result = await checkReserveInSameCampaigns({ campaign: { guideName: 'guide1', requiredObject: 'obj1' }, userName: 'user1' });
      expect(result).to.be.false;
    });
    it('check with same campaigns by guideName and main object and user( status is assigned ) and campaign status is not active', async () => {
      await CampaignFactory.Create({
        guideName: 'guide1',
        status: 'inactive',
        requiredObject: 'obj1',
        users: [{
          name: 'user1',
          object_permlink: 'obj1',
          permlink: faker.random.number(),
          status: 'assigned',
          createdAt: new Date(),
          hiveCurrency: 1,
        },
        ],
        activation_permlink: 'activation_permlink1',
      });
      const result = await checkReserveInSameCampaigns({ campaign: { guideName: 'guide1', requiredObject: 'obj1' }, userName: 'user1' });
      expect(result).to.be.true;
    });
  });
});
