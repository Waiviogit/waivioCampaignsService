const {
  expect, faker, dropDatabase, ObjectID, redis, redisSetter, getDashboard, getCampaign,
  Campaign, sinon, steemHelper, campaignModel, createCampaign, reservationOps,
  getDataForFirstLoad, getSuitableUsers, _, currencyRequest, campaignActivation,
} = require('test/testHelper');
const paymentHistory = require('utilities/operations/paymentHistory');
const {
  CampaignFactory, UserFactory, WobjectFactory, PaymentHistoryFactory,
} = require('test/factories');
const { maxCampaignsAssign } = require('constants/constants');
const moment = require('moment');

describe('Campaign', async () => {
  describe('create', async () => {
    let campaignParams;

    beforeEach(async () => {
      await dropDatabase();
      campaignParams = {
        guideName: `${faker.name.firstName()}${faker.random.number()}`,
        name: `${faker.name.firstName()}${faker.random.number()}`,
        description: `${faker.lorem.words()}`,
        type: 'reviews',
        note: faker.lorem.words(),
        budget: 100,
        reward: 10.5,
        requirements: { minPhotos: 1 },
        userRequirements: { minFollowers: 1, minPosts: 1 },
        requiredObject: 'req_obj1',
        objects: ['obj1', 'obj2', 'obj3'],
        expired_at: faker.date.future(1),
      };
    });

    it('should create campaign', async () => {
      const { campaign } = await createCampaign(campaignParams);

      expect(campaign).to.be.exist;
    });

    it('should create campaign with compensation account', async () => {
      campaignParams.compensationAccount = 'someAcc';
      const { campaign } = await createCampaign(campaignParams);

      expect(campaign.compensationAccount).to.be.eq('someAcc');
    });

    it('should create campaign with receiptPhoto data true', async () => {
      campaignParams.requirements.receiptPhoto = true;
      const { campaign } = await createCampaign(campaignParams);

      expect(campaign.requirements.receiptPhoto).to.be.true;
    });

    it('should create campaign without receiptPhoto data', async () => {
      const { campaign } = await createCampaign(campaignParams);

      expect(campaign.requirements.receiptPhoto).to.be.false;
    });

    it('should create campaign with receiptPhoto data false', async () => {
      campaignParams.requirements.receiptPhoto = false;
      const { campaign } = await createCampaign(campaignParams);

      expect(campaign.requirements.receiptPhoto).to.be.false;
    });

    it('should create campaign with app data', async () => {
      sinon.stub(steemHelper, 'getAccountInfo').returns(Promise.resolve(true));
      campaignParams.app = 'app';
      const { campaign } = await createCampaign(campaignParams);

      expect(campaign.app).to.be.eq('app');
    });

    it('should create campaign with frequency reservation', async () => {
      campaignParams.frequency_assign = 5;
      const { campaign } = await createCampaign(campaignParams);

      expect(campaign.frequency_assign).to.be.eq(5);
    });

    it('should create campaign with expertise reputation', async () => {
      campaignParams.userRequirements.minExpertise = 50;
      const { campaign } = await createCampaign(campaignParams);

      expect(campaign.userRequirements.minExpertise).to.be.eq(50);
    });

    it('should create campaign with commission agreement', async () => {
      campaignParams.commissionAgreement = 0.55;
      const { campaign } = await createCampaign(campaignParams);

      expect(campaign.commissionAgreement).to.be.eq(0.55);
    });

    it('should create campaign with usersLegalNotice', async () => {
      campaignParams.usersLegalNotice = 'bla';
      const { campaign } = await createCampaign(campaignParams);

      expect(campaign.usersLegalNotice).to.be.eq('bla');
    });

    it('should create campaign with agreementObjects', async () => {
      const objects = ['obj1', 'obj2', 'obj3'];

      campaignParams.agreementObjects = objects;
      const { campaign } = await createCampaign(campaignParams);

      expect(campaign.agreementObjects).to.be.eql(objects);
    });

    it('should create campaign with default reservation_timetable', async () => {
      const days = {
        monday: true,
        tuesday: true,
        wednesday: true,
        thursday: true,
        friday: true,
        saturday: true,
        sunday: true,
      };
      const { campaign } = await createCampaign(campaignParams);

      expect(campaign).to.be.exist;
      expect(campaign.reservation_timetable.toObject()).to.be.eql(days);
    });

    it('should create campaign with invalid keys reservation_timetable', async () => {
      const days = {
        monday: true,
        tuesday: true,
        wednesday: true,
        thursday: true,
        friday: false,
        saturday: true,
        sunday: true,
      };

      campaignParams.reservation_timetable = {
        a: true,
        b: false,
        c: true,
        d: true,
        friday: false,
        s: false,
        r: true,
      };
      const { campaign } = await createCampaign(campaignParams);

      expect(campaign).to.be.exist;
      expect(campaign.reservation_timetable.toObject()).to.be.eql(days);
    });

    it('should create campaign with some days of reservation_timetable', async () => {
      const days = {
        monday: true,
        tuesday: true,
        wednesday: false,
        thursday: true,
        friday: false,
        saturday: true,
        sunday: true,
      };

      campaignParams.reservation_timetable = {
        wednesday: false,
        friday: false,
      };
      const { campaign } = await createCampaign(campaignParams);

      expect(campaign).to.be.exist;
      expect(campaign.reservation_timetable.toObject()).to.be.eql(days);
    });

    it('should create campaign with invalid reservation_timetable', async () => {
      campaignParams.reservation_timetable = {
        monday: 'one',
        tuesday: false,
        wednesday: true,
        thursday: true,
        friday: false,
        saturday: false,
        sunday: true,
      };
      const { error } = await createCampaign(campaignParams);

      expect(error).to.be.exist;
    });

    it('should create campaign with reservation_timetable', async () => {
      campaignParams.reservation_timetable = {
        monday: true,
        tuesday: false,
        wednesday: true,
        thursday: true,
        friday: false,
        saturday: false,
        sunday: true,
      };
      const { campaign } = await createCampaign(campaignParams);

      expect(campaign).to.be.exist;
      expect(campaign.reservation_timetable.toObject())
        .to.be.eql(campaignParams.reservation_timetable);
    });

    it('should create campaign with one match bot', async () => {
      campaignParams.match_bots = ['guest123'];
      const { campaign } = await createCampaign(campaignParams);

      expect(campaign.match_bots).to.be.eql(campaignParams.match_bots);
    });

    it('should create campaign with two match bots', async () => {
      campaignParams.match_bots = ['guest123', 'social'];
      const { campaign } = await createCampaign(campaignParams);

      expect(campaign.match_bots).to.be.eql(campaignParams.match_bots);
    });

    it('should create campaign with invalid match bot', async () => {
      campaignParams.match_bots = ['aaa'];
      const { campaign } = await createCampaign(campaignParams);

      expect(campaign.match_bots).to.be.eql(['aaa']);
    });

    it('should create campaign with blacklist_users', async () => {
      campaignParams.blacklist_users = ['user1', 'user2'];
      const { campaign } = await createCampaign(campaignParams);

      expect(campaign.blacklist_users).to.be.eql(['user1', 'user2']);
    });

    it('should create campaign with default count of reservation days', async () => {
      const { campaign } = await createCampaign(campaignParams);

      expect(campaign.count_reservation_days).to.be.eq(1);
    });

    it('should create campaign with count of reservation days', async () => {
      campaignParams.count_reservation_days = 5;
      const { campaign } = await createCampaign(campaignParams);

      expect(campaign.count_reservation_days).to.be.eq(5);
    });

    it('should create campaign with whitelist_users', async () => {
      campaignParams.whitelist_users = ['user1', 'user2'];
      const { campaign } = await createCampaign(campaignParams);

      expect(campaign.whitelist_users).to.be.eql(['user1', 'user2']);
    });

    it('should update campaign', async () => {
      const { campaign } = await createCampaign(campaignParams);

      campaignParams.id = campaign.id;
      campaignParams.name = 'newName';
      const newCampaign = await createCampaign(campaignParams);

      expect(newCampaign.campaign.name).to.be.eq('newName');
      expect(newCampaign.campaign.id).to.be.eq(campaign.id);
    });

    it('should update campaign with compenstion account', async () => {
      const { campaign } = await createCampaign(campaignParams);

      campaignParams.id = campaign.id;
      campaignParams.name = 'newName';
      campaignParams.compensationAccount = 'newAcc';
      const newCampaign = await createCampaign(campaignParams);

      expect(newCampaign.campaign.compensationAccount).to.be.eq('newAcc');
    });

    it('should update campaign with exist compenstion account to undefined', async () => {
      campaignParams.compensationAccount = 'someAcc';
      const { campaign } = await createCampaign(campaignParams);

      campaignParams.id = campaign.id;
      campaignParams.name = 'newName';
      campaignParams.compensationAccount = undefined;
      const newCampaign = await createCampaign(campaignParams);

      expect(newCampaign.campaign.compensationAccount).to.be.eq(null);
    });

    it('should update campaign with exist compenstion account to new value', async () => {
      campaignParams.compensationAccount = 'someAcc';
      const { campaign } = await createCampaign(campaignParams);

      campaignParams.id = campaign.id;
      campaignParams.name = 'newName';
      campaignParams.compensationAccount = 'newAcc';
      const newCampaign = await createCampaign(campaignParams);

      expect(newCampaign.campaign.compensationAccount).to.be.eq('newAcc');
    });

    it('should not update campaign without status pending', async () => {
      const campaign = await CampaignFactory.Create({ status: 'active' });

      campaignParams.id = campaign.id;
      campaignParams.name = 'newName';
      const newCampaign = await createCampaign(campaignParams);

      expect(newCampaign.campaign.id).to.be.not.eq(campaign.id);
    });

    it('should not update campaign with incorrect data', async () => {
      const { campaign } = await createCampaign(campaignParams);

      campaignParams.id = campaign.id;
      campaignParams.name = undefined;
      const { error } = await createCampaign(campaignParams);

      expect(error.message).to.be.eq('Validation failed: name: Path `name` is required.');
    });

    it('should not create campaign without objects', async () => {
      campaignParams.objects = [];

      const { error } = await createCampaign(campaignParams);

      expect(error.message).to.be.eq('Campaign validation failed: objects: Validator failed for path `objects` with value ``');
    });

    it('should not create campaign with reward > budget', async () => {
      campaignParams.reward = 101;
      const { error } = await createCampaign(campaignParams);

      expect(error.message).to.be.eq('Reward more than budget');
    });

    it('should create campaign with reward equal budget', async () => {
      campaignParams.reward = 100;
      const { campaign } = await createCampaign(campaignParams);

      expect(campaign).to.be.exist;
    });

    it('should not create campaign with invalid objects', async () => {
      campaignParams.objects = [' '];

      const { error } = await createCampaign(campaignParams);

      expect(error.message).to.be.eq('Campaign validation failed: objects: Validator failed for path `objects` with value ``');
    });

    it('should create campaign with invalid objects and valid object', async () => {
      campaignParams.objects = [' ', 'obj'];
      const { campaign } = await createCampaign(campaignParams);
      expect(campaign.objects.length).to.be.eq(1);
    });

    it('should not create campaign without guide name', async () => {
      delete campaignParams.guideName;
      const { error } = await createCampaign(campaignParams);
      expect(error.message).to.be.eq('Campaign validation failed: guideName: Path `guideName` is required.');
    });

    it('should create campaign with name maxlenth', async () => {
      campaignParams.name = 'a'.repeat(256);
      const { campaign } = await createCampaign(campaignParams);
      expect(campaign).to.be.exist;
    });

    it('should not create campaign with name maxlenth++', async () => {
      campaignParams.name = 'a'.repeat(257);
      const { error } = await createCampaign(campaignParams);
      expect(error.message)
        .to.be.eq(`Campaign validation failed: name: Path \`name\` (\`${campaignParams.name}\`) is longer than the maximum allowed length (256).`);
    });

    it('should create campaign without description', async () => {
      delete campaignParams.description;
      const { campaign } = await createCampaign(campaignParams);
      expect(campaign).to.be.exist;
    });

    it('should create campaign with description maxlenth', async () => {
      campaignParams.description = 'a'.repeat(512);
      const { campaign } = await createCampaign(campaignParams);
      expect(campaign).to.be.exist;
    });

    it('should not create campaign with long description', async () => {
      campaignParams.description = 'a'.repeat(523);
      const { error } = await createCampaign(campaignParams);
      expect(error.message)
        .to.be.eq(`Campaign validation failed: description: Path \`description\` (\`${campaignParams.description}\`) is longer than the maximum allowed length (512).`);
    });

    it('should not create campaign without type', async () => {
      delete campaignParams.type;
      const { error } = await createCampaign(campaignParams);
      expect(error.message).to.be.eq('Campaign validation failed: type: Path `type` is required.');
    });

    it('should not create campaign with incorrect type', async () => {
      campaignParams.type = 'incorrectType';
      const { error } = await createCampaign(campaignParams);
      expect(error.message)
        .to.be.eq('Campaign validation failed: type: `incorrectType` is not a valid enum value for path `type`.');
    });

    it('should create campaign with empty note', async () => {
      delete campaignParams.note;
      const { campaign } = await createCampaign(campaignParams);
      expect(campaign).to.be.exist;
    });

    it('should not create campaign with long note', async () => {
      campaignParams.note = 'a'.repeat(257);
      const { error } = await createCampaign(campaignParams);
      expect(error.message)
        .to.be.eq(`Campaign validation failed: note: Path \`note\` (\`${'a'.repeat(257)}\`) is longer than the maximum allowed length (256).`);
    });

    it('should not create campaign without budget', async () => {
      delete campaignParams.budget;
      const { error } = await createCampaign(campaignParams);
      expect(error.message).to.be.eq('Campaign validation failed: budget: Path `budget` is required.');
    });
    it('should not create campaign with zero budget', async () => {
      campaignParams.budget = 0;
      const { error } = await createCampaign(campaignParams);
      expect(error.message).to.be.eq('Campaign validation failed: budget: Path `budget` (0) is less than minimum allowed value (0.001).');
    });
    it('should not create campaign without reward', async () => {
      delete campaignParams.reward;
      const { error } = await createCampaign(campaignParams);
      expect(error.message).to.be.eq('Campaign validation failed: reward: Path `reward` is required.');
    });
    it('should not create campaign with zero reward', async () => {
      campaignParams.reward = 0;
      const { error } = await createCampaign(campaignParams);
      expect(error.message).to.be.eq('Campaign validation failed: reward: Path `reward` (0) is less than minimum allowed value (0.001).');
    });
    it('should not create campaign without requirements', async () => {
      delete campaignParams.requirements;
      const { error } = await createCampaign(campaignParams);
      expect(error.message).to.be.eq('Campaign validation failed: requirements.minPhotos: Path `requirements.minPhotos` is required.');
    });
    it('should not create campaign with requirements = null', async () => {
      campaignParams.requirements = null;
      const { error } = await createCampaign(campaignParams);
      expect(error.message).to.be.eq('Campaign validation failed: requirements.minPhotos: Path `requirements.minPhotos` is required.');
    });
    it('should not create campaign with requirements equal empty object', async () => {
      campaignParams.requirements = {};
      const { error } = await createCampaign(campaignParams);
      expect(error.message).to.be.eq('Campaign validation failed: requirements.minPhotos: Path `requirements.minPhotos` is required.');
    });
    it('should update campaign status to inactive', async () => {
      const status = 'inactive';
      const { campaign } = await createCampaign(campaignParams);
      const updatedCampaign = await campaignModel.changeStatus(campaign.id, status);
      expect(updatedCampaign.status).to.be.eq(status);
    });
    it('should update campaign status to payed', async () => {
      const status = 'payed';
      const { campaign } = await createCampaign(campaignParams);
      const updatedCampaign = await campaignModel.changeStatus(campaign.id, status);
      expect(updatedCampaign.status).to.be.eq(status);
    });
    it('should not update campaign with incorrect status', async () => {
      const status = 'incorrect';
      const { campaign } = await createCampaign(campaignParams);
      const { error } = await campaignModel.changeStatus(campaign.id, status);
      expect(error.message).to.be.eq('Campaign validation failed: status: `incorrect` is not a valid enum value for path `status`.');
    });
    it('should not deactivate with incorrect id', async () => {
      const updatedCampaign = await campaignModel.changeStatus('5ce5227781bb7e755768ba1b', 'active');
      expect(updatedCampaign.error.message).to.be.eq('Campaign not found');
    });
  });

  describe('get campaign', async () => {
    before(async () => {
      await UserFactory.Create({ name: 'guide1', alias: 'aliasName' });
      await CampaignFactory.Create({ guideName: 'guide1' });
    });
    it('should not get campaign with non exist campaign id', async () => {
      const { campaign } = await getCampaign({ campaign_id: new ObjectID() });
      expect(campaign).to.be.null;
    });
    it('should not get campaign with invalid campaign id', async () => {
      const { error } = await getCampaign({ campaign_id: 'sdfs' });
      expect(error.message).to.be.exist;
    });
  });

  describe('destroy', async () => {
    it('should destroy campaign', async () => {
      const campaign = await CampaignFactory.Create({ status: 'pending' });
      const deletedCampaign = await campaignModel.destroyCampaign(campaign._id);
      expect(deletedCampaign).to.be.exist;
    });
    it('should not destroy campaign with status active', async () => {
      const campaign = await CampaignFactory.Create({ status: 'active' });
      const deletedCampaign = await campaignModel.destroyCampaign(campaign.id);
      expect(deletedCampaign).to.be.null;
    });
    it('should not destroy campaign with invalid ID', async () => {
      const deletedCampaign = await campaignModel.destroyCampaign(new ObjectID());
      expect(deletedCampaign).to.be.null;
    });
  });

  describe('activate campaign', async () => {
    before(async () => {
      const users = ['user0'];
      for (let i = 0; i < 15; i++) {
        await UserFactory.Create({ name: `name${i}`, users_follow: users, count_posts: i });
        users.push(`user${i}`);
      }
    });
    it('should activate campaign', async () => {
      const newCampaign = await CampaignFactory.Create({
        guideName: 'eugenezh', status: 'pending', budget: 1.1, reward: 1,
      });
      await campaignActivation.activate(newCampaign._id, 'eugenezh', 'unique_permlink');
      const campaign = await Campaign.findOne({ _id: newCampaign._id });
      expect(campaign.status).to.be.eq('active');
    });
    it('should not activate campaign with not unique permlink', async () => {
      const newCampaign1 = await CampaignFactory.Create({
        guideName: 'eugenezh', status: 'pending', budget: 1.1, reward: 1,
      });
      const newCampaign2 = await CampaignFactory.Create({
        guideName: 'eugenezh', status: 'pending', budget: 1.1, reward: 1,
      });
      await campaignActivation.activate(newCampaign1._id, 'eugenezh', 'permlink');
      await campaignActivation.activate(newCampaign2._id, 'eugenezh', 'permlink');
      const campaign = await Campaign.findOne({ _id: newCampaign2._id });
      expect(campaign.status).to.be.eq('pending');
    });
    it('should not activate campaign with invalid expiration time( < (time_now + 1 day))', async () => {
      const newCampaign = await CampaignFactory.Create({
        guideName: 'eugenezh', status: 'pending', budget: 1.1, reward: 1, expired_at: new Date(),
      });
      await campaignActivation.activate(newCampaign._id, 'eugenezh', 'permlink');
      const campaign = await Campaign.findOne({ _id: newCampaign._id });
      expect(campaign.status).to.be.eq('pending');
    });
    it('should not activate campaign without guide name', async () => {
      const newCampaign = await CampaignFactory.Create({
        guideName: 'eugenezh', status: 'pending', budget: 1.1, reward: 1,
      });
      await campaignActivation.activate(newCampaign._id, null, 'permlink');
      const campaign = await Campaign.findOne({ _id: newCampaign._id });
      expect(campaign.status).to.be.eq('pending');
    });
    it('should not activate campaign without permlink', async () => {
      const newCampaign = await CampaignFactory.Create({
        guideName: 'eugenezh', status: 'pending', budget: 1.1, reward: 1,
      });
      await campaignActivation.activate(newCampaign._id, 'eugenezh');
      const campaign = await Campaign.findOne({ _id: newCampaign._id });
      expect(campaign.status).to.be.eq('pending');
    });
    it('should not activate campaign with invalid guide name', async () => {
      const newCampaign = await CampaignFactory.Create({
        guideName: 'eugenezh', status: 'pending', budget: 1.1, reward: 1,
      });
      await campaignActivation.activate(newCampaign._id, 'eugenezsdfh', 'permlink');
      const campaign = await Campaign.findOne({ _id: newCampaign._id });
      expect(campaign.status).to.be.eq('pending');
    });
    it('should not activate campaign with more budget than balance', async () => {
      const newCampaign = await CampaignFactory.Create({
        guideName: 'eugenezh', status: 'pending', budget: 100, reward: 1,
      });
      await campaignActivation.activate(newCampaign._id, 'eugenezh', 'permlink');
      const campaign = await Campaign.findOne({ _id: newCampaign._id });
      expect(campaign.status).to.be.eq('pending');
    });
    it('should not activate campaign with non pending status', async () => {
      const newCampaign = await CampaignFactory.Create({
        guideName: 'eugenezh', status: 'payed', budget: 1.1, reward: 1,
      });
      await campaignActivation.activate(newCampaign._id, 'eugenezh', 'permlink');
      const campaign = await Campaign.findOne({ _id: newCampaign._id });
      expect(campaign.status).to.be.eq('payed');
    });
  });

  describe('inactivate campaign', async () => {
    let active_campaign, pending_campaign, user;
    beforeEach(async () => {
      await dropDatabase();
      active_campaign = await CampaignFactory.Create({ guideName: 'eugenezh', status: 'active', activation_permlink: 'activation_permlink' });
      pending_campaign = await CampaignFactory.Create({ guideName: 'eugenezh', status: 'pending' });
      user = await UserFactory.Create();
    });

    it('should change status to onHold if at campaign exists active assigns', async () => {
      const { result } = await campaignActivation.inactivate({
        campaign_permlink: active_campaign.activation_permlink,
        guide_name: 'eugenezh',
        permlink: 'permlink',
      });
      const updatedCampaign = await Campaign.findOne({ _id: active_campaign._id });
      expect(result).to.be.true;
      expect(updatedCampaign.status).to.be.eq('onHold');
      expect(updatedCampaign.deactivation_permlink).to.be.eq('permlink');
    });

    it('should not inactivate not active campaign', async () => {
      const { result } = await campaignActivation.inactivate({
        campaign_permlink: pending_campaign.activation_permlink,
        guide_name: 'eugenezh',
        permlink: 'permlink',
      });
      const updatedCampaign = await Campaign.findOne({ _id: pending_campaign._id });

      expect(result).to.be.false;
      expect(updatedCampaign.status).to.be.eq('pending');
    });
    it('should not inactivate with invalid guide name', async () => {
      const { result } = await campaignActivation.inactivate({
        campaign_permlink: active_campaign.activation_permlink,
        guide_name: 'asdasd',
        permlink: 'permlink',
      });
      const updatedCampaign = await Campaign.findOne({ _id: active_campaign._id });
      expect(result).to.be.false;
      expect(updatedCampaign.status).to.be.eq('active');
    });
    it('should not inactivate with invalid campaign activation permlink', async () => {
      const { result } = await campaignActivation.inactivate(
        { campaign_permlink: 'invalid_permlink', guide_name: 'eugenezh', permlink: 'permlink' },
      );
      const updatedCampaign = await Campaign.findOne({ _id: active_campaign._id });
      expect(result).to.be.false;
      expect(updatedCampaign.status).to.be.eq('active');
    });
    it('should not inactivate without deactivation permlink', async () => {
      const { result } = await campaignActivation.inactivate(
        { campaign_permlink: active_campaign.activation_permlink, guide_name: 'eugenezh' },
      );
      const updatedCampaign = await Campaign.findOne({ _id: active_campaign._id });
      expect(result).to.be.false;
      expect(updatedCampaign.status).to.be.eq('active');
    });
  });

  describe('GET suitable_users', async () => {
    beforeEach(async () => {
      await dropDatabase();
      const users = ['user0'];
      for (let i = 0; i < 15; i++) {
        await UserFactory.Create({ name: `name${i}`, users_follow: users, count_posts: i });
        await users.push(`user${i + 1}`);
      }
    });
    it('return all suitable users', async () => {
      const { users } = await getSuitableUsers({
        count_posts: 0, count_follows: 0, skip: 0, limit: 30,
      });
      expect(users.length).to.be.eq(15);
    });
    it('return all suitable users with limit', async () => {
      const { users } = await getSuitableUsers({
        count_posts: 0, count_follows: 0, skip: 0, limit: 5,
      });
      expect(users.length).to.be.eq(5);
    });
    it('return all suitable users with skip', async () => {
      const { users } = await getSuitableUsers({
        count_posts: 0, count_follows: 0, skip: 7, limit: 30,
      });
      expect(users.length).to.be.eq(8);
    });
    it('return all suitable users with follows count 1', async () => {
      const { users } = await getSuitableUsers({
        count_posts: 0, count_follows: 1, skip: 0, limit: 30,
      });
      expect(users.length).to.be.eq(15);
    });
    it('return all suitable users with follows count 8', async () => {
      const { users } = await getSuitableUsers({
        count_posts: 0, count_follows: 8, skip: 0, limit: 30,
      });
      expect(users.length).to.be.eq(8);
    });
    it('return all suitable users with max follows count ', async () => {
      const { users } = await getSuitableUsers({
        count_posts: 0, count_follows: 15, skip: 0, limit: 30,
      });
      expect(users.length).to.be.eq(1);
    });
    it('return all suitable users with follows count > max ', async () => {
      const { users } = await getSuitableUsers({
        count_posts: 0, count_follows: 16, skip: 0, limit: 30,
      });
      expect(users.length).to.be.eq(0);
    });
    it('return all suitable users with posts count 1', async () => {
      const { users } = await getSuitableUsers({
        count_posts: 1, count_follows: 0, skip: 0, limit: 30,
      });
      expect(users.length).to.be.eq(14);
    });
    it('return all suitable users with posts count 8', async () => {
      const { users } = await getSuitableUsers({
        count_posts: 8, count_follows: 0, skip: 0, limit: 30,
      });
      expect(users.length).to.be.eq(7);
    });
    it('return all suitable users with max posts count ', async () => {
      const { users } = await getSuitableUsers({
        count_posts: 14, count_follows: 0, skip: 0, limit: 30,
      });
      expect(users.length).to.be.eq(1);
    });
    it('return all suitable users with posts count > max ', async () => {
      const { users } = await getSuitableUsers({
        count_posts: 15, count_follows: 0, skip: 0, limit: 30,
      });
      expect(users.length).to.be.eq(0);
    });
    it('return all suitable users with posts count 0 and follows count 10 ', async () => {
      const { users } = await getSuitableUsers({
        count_posts: 0, count_follows: 10, skip: 0, limit: 30,
      });
      expect(users.length).to.be.eq(6);
    });
    it('return all suitable users with posts count 0 and follows count 15 ', async () => {
      const { users } = await getSuitableUsers({
        count_posts: 0, count_follows: 15, skip: 0, limit: 30,
      });
      expect(users.length).to.be.eq(1);
    });
    it('return all suitable users with posts count 7 and follows count 9 ', async () => {
      const { users } = await getSuitableUsers({
        count_posts: 7, count_follows: 9, skip: 0, limit: 30,
      });
      expect(users.length).to.be.eq(7);
    });
    it('return all suitable users with posts count 17 and follows count 19 ', async () => {
      const { users } = await getSuitableUsers({
        count_posts: 17, count_follows: 19, skip: 0, limit: 30,
      });
      expect(users.length).to.be.eq(0);
    });
  });

  describe('get can create more campaigns', async () => {
    before(async () => {
      await dropDatabase();
      for (let i = 0; i < maxCampaignsAssign - 1; i++) {
        await CampaignFactory.Create({ guideName: 'name', status: 'active' });
      }
      await CampaignFactory.Create({ guideName: 'name', status: 'pending' });
    });
    it('should return true ', async () => {
      const result = await campaignModel.canCreateMoreCampaigns('name');
      expect(result).to.be.true;
    });
    it('should return true if campaings size equals maxCampaignsAssign', async () => {
      await CampaignFactory.Create({ guideName: 'name', status: 'active' });
      const result = await campaignModel.canCreateMoreCampaigns('name');
      expect(result).to.be.true;
    });
    it('should return false', async () => {
      await CampaignFactory.Create({ guideName: 'name', status: 'active' });
      await CampaignFactory.Create({ guideName: 'name', status: 'active' });
      const result = await campaignModel.canCreateMoreCampaigns('name');
      expect(result).to.be.false;
    });
  });

  describe('Adding user to campaign', async () => {
    let active_campaign, days;
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
      await WobjectFactory.Create({ author_permlink: 'obj1', coordinates: [20, 30], objects: ['obj1', 'obj2'] });
      await WobjectFactory.Create({ author_permlink: 'obj2', coordinates: [20, 30] });
      sinon.stub(currencyRequest, 'getHiveCurrency').returns(Promise.resolve({ usdCurrency: 1 }));
      active_campaign = await CampaignFactory.Create({
        status: 'active', requiredObject: 'obj1', users: [], activation_permlink: campaign_permlink1,
      });
      await CampaignFactory.Create({
        status: 'pending',
        requiredObject: 'obj2',
        users: [],
        activation_permlink: campaign_permlink2,
      });
    });
    afterEach(async () => {
      sinon.restore();
    });
    describe('assign object', async () => {
      it('should add user to active campaign', async () => {
        const { result } = await reservationOps.assign({
          campaign_permlink: campaign_permlink1,
          user_name: 'name1',
          approved_object: 'obj1',
          reservation_permlink: 'permlink1',
        });
        const campaign = await Campaign.findOne({ _id: active_campaign._id });

        expect(result).to.be.true;
        expect(campaign.users.length).to.be.eq(1);
      });
      it('should add user to active campaign with referral account', async () => {
        const { result } = await reservationOps.assign({
          campaign_permlink: campaign_permlink1,
          user_name: 'name1',
          approved_object: 'obj1',
          reservation_permlink: 'permlink1',
          referral_account: 'referral_acc',
        });
        const campaign = await Campaign.findOne({ _id: active_campaign._id });

        expect(result).to.be.true;
        expect(campaign.users.length).to.be.eq(1);
        expect(campaign.users[0].referral_server).to.be.eq('referral_acc');
      });

      it('should add user to active campaign with the same budget and reward', async () => {
        await CampaignFactory.Create({
          budget: 1,
          reward: 1,
          status: 'active',
          requiredObject: 'obj1',
          users: [],
          activation_permlink: 'same_budget_reward',
        });
        const { result } = await reservationOps.assign({
          campaign_permlink: 'same_budget_reward',
          user_name: 'name1',
          approved_object: 'obj1',
          reservation_permlink: 'permlink1',
          users: [],
        });
        const campaign = await Campaign.findOne({ activation_permlink: 'same_budget_reward' });
        expect(result).to.be.true;
        expect(campaign.users.length).to.be.eq(1);
      });

      it('should add many users to active campaign', async () => {
        await UserFactory.Create({ name: 'name2' });
        await reservationOps.assign({
          campaign_permlink: campaign_permlink1,
          user_name: 'name1',
          approved_object: 'obj1',
          reservation_permlink: 'permlink1',
        });
        await reservationOps.assign({
          campaign_permlink: campaign_permlink1,
          user_name: 'name2',
          approved_object: 'obj1',
          reservation_permlink: 'permlink2',
        });
        const campaign = await Campaign.findOne({ _id: active_campaign._id });
        expect(campaign.users.length).to.be.eq(2);
        expect(campaign.users[0].name).to.be.eq('name1');
        expect(campaign.users[1].name).to.be.eq('name2');
        expect(campaign.users[0].object_permlink).to.be.eq('obj1');
        expect(campaign.users[0].permlink).to.be.eq('permlink1');
        expect(campaign.users[1].object_permlink).to.be.eq('obj1');
        expect(campaign.users[1].permlink).to.be.eq('permlink2');
      });

      describe('limit reservation days', async () => {
        it('check count reservation days by custom value', async () => {
          // eslint-disable-next-line max-len
          const todaySpendTime = (new Date().getUTCHours() * 3600 + new Date().getUTCMinutes() * 60 + new Date().getUTCSeconds());
          const expext_days_time = 86400 * 5;

          await CampaignFactory.Create({
            status: 'active',
            requiredObject: 'obj1',
            users: [],
            reservation_timetable: days,
            count_reservation_days: 5,
            activation_permlink: campaign_permlink3,
          });
          const { result } = await reservationOps.assign({
            campaign_permlink: campaign_permlink3,
            user_name: 'name1',
            approved_object: 'obj1',
            reservation_permlink: 'permlink1',
          });
          const ttlReservation = await redis.campaigns.ttlAsync('expire:assign_permlink1');

          expect(result).to.be.true;
          expect(ttlReservation).to.be.eq(expext_days_time - todaySpendTime);
        });

        it('check count reservation days with limit by days', async () => {
          // eslint-disable-next-line max-len
          const todaySpendTime = (new Date().getUTCHours() * 3600 + new Date().getUTCMinutes() * 60 + new Date().getUTCSeconds());
          const expext_days_time = 86400 * 2;

          days[Object.keys(days)[currentDay === 6 ? 0 : currentDay + 1]] = false;
          await CampaignFactory.Create({
            status: 'active',
            requiredObject: 'obj1',
            users: [],
            reservation_timetable: days,
            count_reservation_days: 5,
            activation_permlink: campaign_permlink5,
          });
          const { result } = await reservationOps.assign({
            campaign_permlink: campaign_permlink5,
            user_name: 'name1',
            approved_object: 'obj1',
            reservation_permlink: 'permlink1',
          });
          const ttlReservation = await redis.campaigns.ttlAsync('expire:assign_permlink1');

          expect(result).to.be.true;
          expect(ttlReservation).to.be.eq(expext_days_time - todaySpendTime);
        });
        it('check count reservation days if current day not allow to reserve', async () => {
          days[Object.keys(days)[(currentDay === 0 ? 7 : currentDay) - 1]] = false;
          await CampaignFactory.Create({
            status: 'active',
            requiredObject: 'obj1',
            users: [],
            reservation_timetable: days,
            count_reservation_days: 5,
            activation_permlink: campaign_permlink4,
          });
          const { result } = await reservationOps.assign({
            campaign_permlink: campaign_permlink4,
            user_name: 'name1',
            approved_object: 'obj1',
            reservation_permlink: 'permlink1',
          });
          expect(result).to.be.false;
        });
      });
      it('should not add user to active campaign with limit and user status assigned', async () => {
        for (let i = 0; i < 9; i++) {
          await UserFactory.Create({ name: `name1${i}` });
          await reservationOps.assign({
            campaign_permlink: campaign_permlink1,
            user_name: `name1${i}`,
            approved_object: 'obj1',
            reservation_permlink: `permlink${i}`,
          });
        }
        const { result } = await reservationOps.assign({
          campaign_permlink: campaign_permlink1,
          user_name: 'name1',
          approved_object: 'obj1',
          reservation_permlink: new Date(),
        });
        const campaign = await Campaign.findOne({ _id: active_campaign._id });
        expect(result).to.be.false;
        expect(campaign.canAssign).to.be.false;
        expect(campaign.users.length).to.be.eq(9);
      });

      it('should not add user to active campaign with limit and user status unassigned', async () => {
        const users = [];
        for (let i = 0; i < 9; i++) {
          const user = await UserFactory.Create({ name: `name1${i}` });
          users.push({
            name: user.name, object_permlink: 'obj1', permlink: `some_permlink${i}`, status: 'unassigned', hiveCurrency: 1,
          });
        }
        await CampaignFactory.Create({
          status: 'active', requiredObject: 'obj1', users, activation_permlink: campaign_permlink5,
        });
        const { result } = await reservationOps.assign({
          campaign_permlink: campaign_permlink5,
          user_name: 'name1',
          approved_object: 'obj1',
          reservation_permlink: new Date(),
        });
        const campaign = await Campaign.findOne({ activation_permlink: campaign_permlink5 });

        expect(result).to.be.true;
        expect(campaign.canAssign).to.be.true;
        expect(campaign.users.length).to.be.eq(10);
      });

      it('should not add user to active campaign with limit and user status completed', async () => {
        const users = [];
        for (let i = 0; i < 9; i++) {
          const user = await UserFactory.Create({ name: `name1${i}` });
          users.push({
            name: user.name, object_permlink: 'obj1', permlink: `some_permlink${i}`, status: 'completed', hiveCurrency: 1,
          });
        }
        await CampaignFactory.Create({
          status: 'active', requiredObject: 'obj1', users, activation_permlink: campaign_permlink5,
        });
        const { result } = await reservationOps.assign({
          campaign_permlink: campaign_permlink5,
          user_name: 'name1',
          approved_object: 'obj1',
          reservation_permlink: new Date(),
        });
        const campaign = await Campaign.findOne({ activation_permlink: campaign_permlink5 });

        expect(result).to.be.false;
        expect(campaign.canAssign).to.be.false;
        expect(campaign.users.length).to.be.eq(9);
      });

      it('should can assign return true without users', async () => {
        await reservationOps.assign({
          campaign_permlink: campaign_permlink1,
          user_name: 'name1',
          approved_object: 'obj1',
          reservation_permlink: 'permlink1',
        });
        const campaign = await Campaign.findOne({ _id: active_campaign._id });

        expect(campaign.canAssign).to.be.true;
      });

      it('should not add the same assigned user and another object', async () => {
        await reservationOps.assign({
          campaign_permlink: campaign_permlink1,
          user_name: 'name1',
          approved_object: 'obj1',
          reservation_permlink: 'permlink1',
        });
        const { result } = await reservationOps.assign({
          campaign_permlink: campaign_permlink1,
          user_name: 'name1',
          approved_object: 'obj2',
          reservation_permlink: 'permlink2',
        });
        const campaign = await Campaign.findOne({ _id: active_campaign._id });

        expect(result).to.be.false;
        expect(campaign.users.length).to.be.eq(1);
      });

      it('should not add the same assigned user and same object', async () => {
        await reservationOps.assign({
          campaign_permlink: campaign_permlink1,
          user_name: 'name1',
          approved_object: 'obj1',
          reservation_permlink: 'permlink1',
        });
        const { result } = await reservationOps.assign({
          campaign_permlink: campaign_permlink1,
          user_name: 'name1',
          approved_object: 'obj1',
          reservation_permlink: 'permlink2',
        });
        const campaign = await Campaign.findOne({ _id: active_campaign._id });

        expect(result).to.be.false;
        expect(campaign.users.length).to.be.eq(1);
      });

      it('should add the same user after unassign', async () => {
        await reservationOps.assign({
          campaign_permlink: campaign_permlink1,
          user_name: 'name1',
          approved_object: 'obj1',
          reservation_permlink: 'permlink1',
        });
        await reservationOps.reject({
          campaign_permlink: campaign_permlink1,
          user_name: 'name1',
          reservation_permlink: 'permlink1',
          unreservation_permlink: new Date(),
        });
        const { result } = await reservationOps.assign({
          campaign_permlink: campaign_permlink1,
          user_name: 'name1',
          approved_object: 'obj1',
          reservation_permlink: 'permlink2',
        });
        const campaign = await Campaign.findOne({ _id: active_campaign._id });
        expect(result).to.be.true;
        expect(campaign.users[0].status).to.be.eq('unassigned');
        expect(campaign.users[1].status).to.be.eq('assigned');
      });
      it('should not add assign object not contains in campaign', async () => {
        const { result } = await reservationOps.assign({
          campaign_id: active_campaign.id,
          user_name: 'name1',
          approved_object: 'obj2d',
        });
        const campaign = await Campaign.findOne({ _id: active_campaign._id });
        expect(result).to.be.false;
        expect(campaign.users.length).to.be.eq(0);
      });
      it('should not add user without userName', async () => {
        const { result } = await reservationOps.assign({
          campaign_permlink: campaign_permlink1,
          approved_object: 'obj1',
          reservation_permlink: 'permlink1',
        });
        expect(result).to.be.false;
      });
      it('should not add user without permlink', async () => {
        const { result } = await reservationOps.assign({ campaign_permlink: campaign_permlink1, approved_object: 'obj1' });
        expect(result).to.be.false;
      });
      it('should not add user without campaign permlink', async () => {
        const { result } = await reservationOps.assign({ user_name: 'name1', approved_object: 'obj1', reservation_permlink: 'permlink1' });
        expect(result).to.be.false;
      });
      it('should not add user without approved_objects', async () => {
        const { result } = await reservationOps.assign({ campaign_permlink: campaign_permlink1, user_name: 'name1', reservation_permlink: 'permlink1' });
        expect(result).to.be.false;
      });
      it('should not add user with invalid approved_objects', async () => {
        const { result } = await reservationOps.assign({
          campaign_permlink: campaign_permlink1,
          user_name: 'name1',
          approved_object: 'obj1dsfds',
          reservation_permlink: 'permlink1',
        });
        expect(result).to.be.false;
      });
      it('should not add user with empty approved_objects', async () => {
        const { result } = await reservationOps.assign({
          campaign_permlink: campaign_permlink1,
          user_name: 'name1',
          approved_object: '',
          reservation_permlink: 'permlink1',
        });
        expect(result).to.be.false;
      });
      it('should not add user to pending campaign', async () => {
        const { result } = await reservationOps.assign({
          campaign_permlink: campaign_permlink2,
          user_name: 'name1',
          approved_object: 'obj1',
          reservation_permlink: 'permlink1',
        });
        expect(result).to.be.false;
      });
      it('should not assigned if limited complete assign', async () => {
        await CampaignFactory.Create({
          status: 'active',
          objects: ['obj1', 'obj2', 'obj3'],
          requiredObject: 'obj1',
          users: [{
            status: 'completed',
            name: 'name1',
            object_permlink: 'obj1',
            permlink: 'permlink1',
            hiveCurrency: 1,
          }],
          activation_permlink: 'campaign_with_completed_users',
        });
        const { result } = await reservationOps.assign({
          campaign_permlink: 'campaign_with_completed_users',
          user_name: 'name1',
          approved_object: 'obj1',
          reservation_permlink: 'permlink1',
        });
        expect(result).to.be.false;
      });
    });

    describe('reject object', async () => {
      it('should remove object from user', async () => {
        await reservationOps.assign({
          campaign_permlink: campaign_permlink1,
          user_name: 'name1',
          approved_object: 'obj1',
          reservation_permlink: 'permlink1',
        });
        const { result } = await reservationOps.reject({
          campaign_permlink: campaign_permlink1,
          user_name: 'name1',
          reservation_permlink: 'permlink1',
          unreservation_permlink: new Date(),
        });
        const campaign = await Campaign.findOne({ _id: active_campaign._id });
        expect(result).to.be.true;
        expect(campaign.users[0].status).to.be.eq('unassigned');
      });
      it('should not remove object from user without unassign permlink', async () => {
        await reservationOps.assign({
          campaign_permlink: campaign_permlink1,
          user_name: 'name1',
          approved_object: 'obj1',
          reservation_permlink: 'permlink1',
        });
        const { result } = await reservationOps.reject({
          campaign_permlink: campaign_permlink1,
          user_name: 'name1',
          reservation_permlink: 'permlink1',
        });
        const campaign = await Campaign.findOne({ _id: active_campaign._id });
        expect(result).to.be.false;
        expect(campaign.users[0].status).to.be.eq('assigned');
      });
      it('should not remove object from user with another permlink', async () => {
        await reservationOps.assign({
          campaign_permlink: campaign_permlink1,
          user_name: 'name1',
          approved_object: 'obj1',
          reservation_permlink: 'permlink1',
        });
        const { result } = await reservationOps.reject({
          campaign_permlink: campaign_permlink1,
          user_name: 'name1',
          reservation_permlink: 'asd',
          unreservation_permlink: new Date(),
        });
        const campaign = await Campaign.findOne({ _id: active_campaign._id });
        expect(result).to.be.false;
        expect(campaign.users[0].status).to.be.eq('assigned');
      });
      it('should not remove object from user with another username', async () => {
        await reservationOps.assign({
          campaign_permlink: campaign_permlink1,
          user_name: 'name1',
          approved_object: 'obj1',
          reservation_permlink: 'permlink1',
        });
        const { result } = await reservationOps.reject({
          campaign_permlink: campaign_permlink1,
          user_name: 'name2',
          reservation_permlink: 'permlink1',
          unreservation_permlink: new Date(),
        });
        const campaign = await Campaign.findOne({ _id: active_campaign._id });
        expect(result).to.be.false;
        expect(campaign.users[0].status).to.be.eq('assigned');
      });
      it('should not remove object from user with another campaign permlink', async () => {
        await reservationOps.assign({
          campaign_permlink: campaign_permlink1,
          user_name: 'name1',
          approved_object: 'obj1',
          reservation_permlink: 'permlink1',
        });
        const { result } = await reservationOps.reject({
          campaign_permlink: 'asdw',
          user_name: 'name1',
          reservation_permlink: 'permlink1',
          unreservation_permlink: new Date(),
        });
        const campaign = await Campaign.findOne({ _id: active_campaign._id });
        expect(result).to.be.false;
        expect(campaign.users[0].status).to.be.eq('assigned');
      });
      it('should not remove object from user with rejected status', async () => {
        await reservationOps.assign({
          campaign_permlink: campaign_permlink1,
          user_name: 'name1',
          approved_object: 'obj1',
          reservation_permlink: 'permlink1',
        });
        await reservationOps.reject({
          campaign_permlink: 'campaign_permlink1',
          user_name: 'name1',
          reservation_permlink: 'permlink1',
          unreservation_permlink: new Date(),
        });
        const { result } = await reservationOps.reject({
          campaign_permlink: 'campaign_permlink1',
          user_name: 'name1',
          approved_object: 'obj1',
          reservation_permlink: 'permlink1',
          unreservation_permlink: new Date(),
        });
        const campaign = await Campaign.findOne({ _id: active_campaign._id });
        expect(result).to.be.false;
        expect(campaign.users[0].status).to.be.eq('unassigned');
      });
    });
  });

  describe('Get campaigns dasboard', async () => {
    const campaignStatus = ['pending', 'active', 'inactive', 'expired', 'deleted', 'payed'];
    let users = [], wobject, payable, balance;

    before(async () => {
      sinon.restore();
      await dropDatabase();
      wobject = await WobjectFactory.Create({ author_permlink: faker.random.string(20) });
      payable = _.random(1, 20);
      balance = _.random(1000, 2000);
      sinon.stub(steemHelper, 'getAccountInfo').returns(Promise.resolve({ balance }));
      sinon.stub(currencyRequest, 'getHiveCurrency').returns(Promise.resolve({ usdCurrency: 1 }));
      sinon.stub(paymentHistory, 'getPayableHistory').returns(Promise.resolve({ payable }));
      await UserFactory.Create({ name: 'guide2' });
      await UserFactory.Create({ name: 'guide1' });
      await UserFactory.Create({ name: 'anotherGuide' });
      for (let i = 0; i < 5; i++) {
        users.push({
          name: `name${i}`, object_permlink: 'obj1', permlink: 'permlink1', status: 'assigned', hiveCurrency: 1,
        });
      }
      for (let i = 0; i < 3; i++) {
        users.push({
          name: `name${i}`, object_permlink: 'obj1', permlink: 'permlink1', status: 'completed', completedAt: new Date(), hiveCurrency: 1,
        });
      }

      for (let i = 0; i < 15; i++) {
        const campaign = await CampaignFactory.Create({
          users,
          guideName: i === 14 ? 'anotherGuide' : 'guide1',
          status: campaignStatus[i % 5],
          requiredObject: wobject.author_permlink,
          objects: [faker.name.firstName()],
        });
        await WobjectFactory.Create({ author_permlink: campaign.objects[0] });
      }
    });
    afterEach(async () => {
      sinon.restore();
    });

    it('check total fields', async () => {
      const { campaigns, budget_total } = await getDashboard({ guideName: 'guide1' });
      expect(campaigns.length).to.be.eq(14);
      expect(campaigns[2].completed).to.be.eq(3);
      expect(campaigns[2].reserved).to.be.eq(5);
      expect(campaigns[2].remaining).to.be.eq(1);
      expect(budget_total.account_amount).to.be.eq(balance);
      expect(_.round(budget_total.sum_payable, 3)).to.be.eq(payable);
      expect(_.round(budget_total.sum_reserved, 3)).to.be.eq(735 + 735 * 0.05);
      expect(_.round(budget_total.remaining, 3)).to.be.eq(balance - payable - (735 + (735 * 0.05)));
    });

    it('check active campaign fields', async () => {
      const { campaigns } = await getDashboard({ guideName: 'guide1' });
      expect(campaigns.length).to.be.eq(14);
      expect(campaigns[2].completed).to.be.eq(3);
      expect(campaigns[2].reserved).to.be.eq(5);
      expect(campaigns[2].remaining).to.be.eq(1);
    });

    it('check inactive active campaign fields', async () => {
      const { campaigns } = await getDashboard({ guideName: 'guide1' });
      expect(campaigns.length).to.be.eq(14);
      expect(campaigns[1].completed).to.be.eq(3);
      expect(campaigns[1].reserved).to.be.eq(5);
      expect(campaigns[1].remaining).to.be.eq(0);
    });

    it('check expired active campaign fields', async () => {
      const { campaigns } = await getDashboard({ guideName: 'guide1' });
      expect(campaigns.length).to.be.eq(14);
      expect(campaigns[0].completed).to.be.eq(3);
      expect(campaigns[0].reserved).to.be.eq(5);
      expect(campaigns[0].remaining).to.be.eq(0);
    });

    it('should check completed', async () => {
      users = [];
      for (let i = 0; i < 8; i++) {
        users.push({
          name: `name${i}`, object_permlink: 'obj1', permlink: 'permlink1', status: 'completed', completedAt: new Date(), hiveCurrency: 1,
        });
      }
      await CampaignFactory.Create({
        guideName: 'guide2', status: 'active', users, requiredObject: wobject.author_permlink,
      });
      const { campaigns } = await getDashboard({ guideName: 'guide2' });
      expect(campaigns[0].completed).to.be.eq(8);
      expect(campaigns[0].reserved).to.be.eq(0);
      expect(campaigns[0].remaining).to.be.eq(1);
    });

    it('should check remaining', async () => {
      const campaign = await CampaignFactory.Create({
        guideName: 'guide2', status: 'active', users: [], requiredObject: wobject.author_permlink, objects: [faker.name.firstName()],
      });
      await WobjectFactory.Create({ author_permlink: campaign.objects[0] });
      const { campaigns } = await getDashboard({ guideName: 'guide2' });
      expect(campaigns[0].completed).to.be.eq(0);
      expect(campaigns[0].reserved).to.be.eq(0);
      expect(campaigns[0].remaining).to.be.eq(9);
    });

    it('should check reserved', async () => {
      users = [];
      for (let i = 0; i < 5; i++) {
        users.push({
          name: `name${i}`, object_permlink: 'obj1', permlink: 'permlink1', status: 'assigned', hiveCurrency: 1,
        });
      }
      const campaign = await CampaignFactory.Create({
        guideName: 'guide2', status: 'active', users, requiredObject: wobject.author_permlink, objects: [faker.name.firstName()],
      });
      await WobjectFactory.Create({ author_permlink: campaign.objects[0] });
      const { campaigns } = await getDashboard({ guideName: 'guide2' });
      expect(campaigns[0].completed).to.be.eq(0);
      expect(campaigns[0].reserved).to.be.eq(5);
      expect(campaigns[0].remaining).to.be.eq(4);
    });
  });

  describe('check expiration time in redis', async () => {
    let campaign;
    beforeEach(async () => {
      await dropDatabase();
      await redis.campaigns.setex('expire:assign_reservation_permlink', 10, '');
      campaign = await CampaignFactory.Create(
        {
          guideName: 'eugenezh',
          status: 'active',
          activation_permlink: 'activation_permlink',
          users: [
            {
              status: 'assigned', name: 'user1', object_permlink: 'object_permlink', permlink: 'reservation_permlink', hiveCurrency: 1,
            },
          ],
        },
      );
    });
    it('should expire campaign', (done) => {
      let result;
      campaign.expired_at = moment().add(1, 'seconds');
      redisSetter.setExpireCampaign(campaign);
      setTimeout(() => {
        Campaign.findOne({ _id: campaign._id }).then((data) => {
          result = data;
        });
      }, 3000);
      setTimeout(() => {
        expect(result.status).to.be.eq('expired');
        done();
      }, 4000);
    });
    it('should expire reservation', (done) => {
      let result;
      redisSetter.setExpireAssign('activation_permlink', 'reservation_permlink', 'obj1', 'user1', 1);
      setTimeout(() => {
        Campaign.findOne({ _id: campaign._id }).then((data) => {
          result = data.users[0];
        });
      }, 2000);
      setTimeout(() => {
        expect(result.status).to.be.eq('expired');
        done();
      }, 3000);
    });

    it('should remove expiration from reservation', (done) => {
      let result;
      redisSetter.removeExpirationAssign('reservation_permlink');
      setTimeout(() => {
        redis.campaigns.getAsync('reservation_permlink').then((data) => {
          result = data;
        });
      }, 2000);
      setTimeout(() => {
        expect(result).to.be.null;
        done();
      }, 3000);
    });
  });
  describe('getDataForFirstLoad', async () => {
    let reqData, userName;
    beforeEach(async () => {
      userName = 'guide1';
      reqData = {
        sort: 'reward',
        skip: 0,
        limit: 10,
        userName,
      };
      await dropDatabase();
    });
    it('return success without records', async () => {
      const results = await getDataForFirstLoad(reqData);
      expect(results.count_history_campaigns).to.be.eq(0);
      expect(results.count_campaigns).to.be.eq(0);
      expect(results.has_payable).to.be.false;
      expect(results.has_receivable).to.be.false;
    });
    it('return success with one active campaign', async () => {
      await CampaignFactory.Create({ guideName: userName, status: 'active' });
      const results = await getDataForFirstLoad(reqData);
      expect(results.count_history_campaigns).to.be.eq(0);
      expect(results.count_campaigns).to.be.eq(1);
      expect(results.has_payable).to.be.false;
      expect(results.has_receivable).to.be.false;
    });
    it('return success with one history campaign', async () => {
      await CampaignFactory.Create({ guideName: userName, status: 'inactive' });
      const results = await getDataForFirstLoad(reqData);
      expect(results.count_history_campaigns).to.be.eq(1);
      expect(results.count_campaigns).to.be.eq(1);
      expect(results.has_payable).to.be.false;
      expect(results.has_receivable).to.be.false;
    });
    it('return success with one history campaign and one active campaign', async () => {
      await CampaignFactory.Create({ guideName: userName, status: 'inactive' });
      await CampaignFactory.Create({ guideName: userName, status: 'active' });
      const results = await getDataForFirstLoad(reqData);
      expect(results.count_history_campaigns).to.be.eq(1);
      expect(results.count_campaigns).to.be.eq(2);
      expect(results.has_payable).to.be.false;
      expect(results.has_receivable).to.be.false;
    });
    it('return success with one receivable', async () => {
      await PaymentHistoryFactory.Create({ userName });
      const results = await getDataForFirstLoad(reqData);
      expect(results.count_history_campaigns).to.be.eq(0);
      expect(results.count_campaigns).to.be.eq(0);
      expect(results.has_payable).to.be.false;
      expect(results.has_receivable).to.be.true;
    });
    it('return success with one payable', async () => {
      await PaymentHistoryFactory.Create({ sponsor: userName });
      const results = await getDataForFirstLoad(reqData);
      expect(results.count_history_campaigns).to.be.eq(0);
      expect(results.count_campaigns).to.be.eq(0);
      expect(results.has_payable).to.be.true;
      expect(results.has_receivable).to.be.false;
    });
    it('return success with payable and receivable', async () => {
      await PaymentHistoryFactory.Create({ sponsor: userName });
      await PaymentHistoryFactory.Create({ userName });
      const results = await getDataForFirstLoad(reqData);
      expect(results.count_history_campaigns).to.be.eq(0);
      expect(results.count_campaigns).to.be.eq(0);
      expect(results.has_payable).to.be.true;
      expect(results.has_receivable).to.be.true;
    });

    it('return success with payable and receivable and campaigns', async () => {
      await CampaignFactory.Create({ guideName: userName, status: 'inactive' });
      await CampaignFactory.Create({ guideName: userName, status: 'active' });
      await PaymentHistoryFactory.Create({ sponsor: userName });
      await PaymentHistoryFactory.Create({ userName });
      const results = await getDataForFirstLoad(reqData);
      expect(results.count_history_campaigns).to.be.eq(1);
      expect(results.count_campaigns).to.be.eq(2);
      expect(results.has_payable).to.be.true;
      expect(results.has_receivable).to.be.true;
    });
  });
});
