const {
  dropDatabase, _, wobjectModel, Wobject, expect,
} = require('test/testHelper');
const {
  CampaignFactory, WobjectFactory,
} = require('test/factories');
const { CAMPAIGN_STATUSES } = require('constants/constants');

describe('wobject model', async () => {
  describe('On updateCampaignsCount', async () => {
    let wobject, campaign, wobjects, requiredObject, objects;
    const authorPermlinks = [];
    beforeEach(async () => {
      await dropDatabase();
      for (let i = 0; i < _.random(3, 10); i++) {
        wobject = await WobjectFactory.Create();
        authorPermlinks.push(wobject.author_permlink);
      }
      requiredObject = _.sample(authorPermlinks);
      objects = _.filter(authorPermlinks, (el) => !_.isEqual(el, requiredObject));
    });
    describe('On active status', async () => {
      beforeEach(async () => {
        campaign = await CampaignFactory.Create({ requiredObject, objects });
        await wobjectModel.updateCampaignsCount({
          wobjPermlinks: authorPermlinks,
          status: CAMPAIGN_STATUSES.ACTIVE,
          id: campaign._id,
        });
        wobjects = await Wobject.find({ author_permlink: { $in: authorPermlinks } }).lean();
      });
      it('should wobjects have same counter', async () => {
        _.forEach(wobjects, (el) => {
          expect(el.activeCampaignsCount).to.be.eq(1);
        });
      });

      it('should wobjects activeCampaigns have same length', async () => {
        _.forEach(wobjects, (el) => {
          expect(el.activeCampaigns).to.have.length(1);
        });
      });

      it('should wobjects activeCampaigns have same id', async () => {
        _.forEach(wobjects, (el) => {
          expect(el.activeCampaigns[0]).to.be.deep.eq(campaign._id);
        });
      });

      it('should not increment if campaign same', async () => {
        await wobjectModel.updateCampaignsCount({
          wobjPermlinks: authorPermlinks,
          status: CAMPAIGN_STATUSES.ACTIVE,
          id: campaign._id,
        });
        wobjects = await Wobject.find({ author_permlink: { $in: authorPermlinks } }).lean();
        _.forEach(wobjects, (el) => {
          expect(el.activeCampaignsCount).to.be.eq(1);
        });
      });

      it('should increment if new campaign launch with same objects', async () => {
        campaign = await CampaignFactory.Create({ requiredObject, objects });
        await wobjectModel.updateCampaignsCount({
          wobjPermlinks: authorPermlinks,
          status: CAMPAIGN_STATUSES.ACTIVE,
          id: campaign._id,
        });
        wobjects = await Wobject.find({ author_permlink: { $in: authorPermlinks } }).lean();
        _.forEach(wobjects, (el) => {
          expect(el.activeCampaignsCount).to.be.eq(2);
        });
      });
    });
    describe('On inactive statuses', async () => {
      let randomCampaign, campaignsArr;
      const inactiveStatuses = _.filter(
        Object.values(CAMPAIGN_STATUSES), (el) => !_.isEqual(el, CAMPAIGN_STATUSES.ACTIVE),
      );
      beforeEach(async () => {
        await dropDatabase();
        campaignsArr = [];
        wobject = await WobjectFactory.Create();
        requiredObject = wobject.author_permlink;
        for (let i = 0; i < _.random(3, 10); i++) {
          campaign = await CampaignFactory.Create(
            { requiredObject },
          );
          await wobjectModel.updateCampaignsCount({
            wobjPermlinks: [requiredObject],
            status: CAMPAIGN_STATUSES.ACTIVE,
            id: campaign._id,
          });
          campaignsArr.push(campaign._id);
        }
        randomCampaign = _.sample(campaignsArr);
        await wobjectModel.updateCampaignsCount({
          wobjPermlinks: [requiredObject],
          status: _.sample(inactiveStatuses),
          id: randomCampaign,
        });
        wobject = await Wobject.findOne({ author_permlink: requiredObject }).lean();
      });

      it('should decrement counter campaigns', async () => {
        expect(wobject.activeCampaignsCount).to.be.eq(campaignsArr.length - 1);
      });

      it('should activeCampaigns have proper length', async () => {
        expect(wobject.activeCampaigns).to.have.length(campaignsArr.length - 1);
      });

      it('should remove campaign id from array counter campaigns', async () => {
        expect(wobject.activeCampaigns).to.not.include(randomCampaign);
      });

      it('should counter stay same if method receive id that already not in array', async () => {
        await wobjectModel.updateCampaignsCount({
          wobjPermlinks: [requiredObject],
          status: _.sample(inactiveStatuses),
          id: randomCampaign,
        });
        wobject = await Wobject.findOne({ author_permlink: requiredObject }).lean();
        expect(wobject.activeCampaignsCount).to.be.eq(campaignsArr.length - 1);
      });

      it('should remove another one campaign', async () => {
        const notRemovedCampaigns = _.filter(campaignsArr, (el) => !_.isEqual(el, randomCampaign));
        const newRandomCampaign = _.sample(notRemovedCampaigns);
        await wobjectModel.updateCampaignsCount({
          wobjPermlinks: [requiredObject],
          status: _.sample(inactiveStatuses),
          id: newRandomCampaign,
        });
        wobject = await Wobject.findOne({ author_permlink: requiredObject }).lean();
        expect(wobject.activeCampaignsCount).to.be.eq(campaignsArr.length - 2);
      });
    });
  });
});
