const rewire = require('rewire');
const { REFERRAL_TYPES } = require('constants/constants');

const paymentsHelper = rewire('utilities/helpers/paymentsHelper');
const distributeReward = paymentsHelper.__get__('distributeReward');
const {
  expect, dropDatabase, paymentHistoryModel, moment, _, sinon, currencyRequest,
  faker, PaymentHistory, BotUpvote, Campaign, ObjectID,
} = require('test/testHelper');
const {
  CampaignFactory, MatchBotFactory, AppFactory, PaymentHistoryFactory, UserFactory,
} = require('test/factories');
const { campaignsForPayments } = require('test/mockData/campaigns');
const { sumBy } = require('utilities/helpers/calcHelper');

describe('PaymentsHelper', async () => {
  beforeEach(async () => {
    sinon.stub(currencyRequest, 'getHiveCurrency').returns(Promise.resolve({ currency: 1 }));
  });
  afterEach(async () => {
    sinon.restore();
  });
  describe('distributeReward', async () => {
    let app, reviwer, beneficiaries, beneficiar1, beneficiar2;

    beforeEach(async () => {
      await dropDatabase();
      app = await AppFactory.Create();
      reviwer = 'reviwer';
      beneficiar1 = 'beneficiar1';
      beneficiar2 = 'beneficiar2';
      beneficiaries = [{ account: beneficiar1, weight: 1000 }];
    });

    it('return with waivio fee and referrals', async () => {
      const { payables } = await distributeReward({
        reviwer, reward: 10, commission: 0.05, server_acc: app.host,
      });
      expect(payables.length).to.be.eq(4);
      expect(payables[0].account).to.be.eq(reviwer);
      expect(payables[0].amount).to.be.eq(10);
      expect(payables[1].account).to.be.eq(app.app_commissions.campaigns_server_acc);
      expect(payables[1].amount).to.be.eq(0.15);
      expect(payables[2].amount).to.be.eq(0.07);
      expect(payables[3].amount).to.be.eq(0.28);
    });

    it('return with campaign server fee', async () => {
      const { payables } = await distributeReward({
        reviwer, reward: 10, server_acc: app.host, commission: 0.05,
      });
      expect(payables.length).to.be.eq(4);
      expect(payables[0].account).to.be.eq(reviwer);
      expect(payables[0].amount).to.be.eq(10);
      expect(payables[1].account).to.be.eq(app.app_commissions.campaigns_server_acc);
      expect(payables[1].amount).to.be.eq(0.15);
      expect(payables[1].type).to.be.eq('campaign_server_fee');
      expect(payables[2].account).to.be.eq(app.app_commissions.index_commission_acc);
      expect(payables[2].amount).to.be.eq(0.07);
      expect(payables[3].amount).to.be.eq(0.28);
    });

    it('return with payment another referral server acc', async () => {
      const referral = faker.random.string();
      await UserFactory.Create({
        followers_count: 10,
        count_posts: 10,
        name: reviwer,
        referral: {
          type: REFERRAL_TYPES.REWARDS,
          endedAt: moment.utc().add(10, 'days').toDate(),
          agent: referral,
        },
      });
      const { payables } = await distributeReward({
        reviwer,
        reward: 10,
        server_acc: app.host,
        referral_acc: referral,
        commission: 0.05,
      });
      expect(payables[3].account).to.be.eq(referral);
      expect(payables[3].amount).to.be.eq(0.28);
      expect(payables[3].type).to.be.eq('referral_server_fee');
    });

    it('return with another referral server fee and campaign_server_fee', async () => {
      const app1 = await AppFactory.Create({ name: 'app1', indexCommission: 0.1, campaignCommission: 0.4 });
      await UserFactory.Create({
        followers_count: 10,
        count_posts: 10,
        name: reviwer,
        referral: {
          type: REFERRAL_TYPES.REWARDS,
          endedAt: moment.utc().add(10, 'days').toDate(),
          agent: 'app2',
        },
      });
      const { payables } = await distributeReward({
        reviwer, reward: 10, server_acc: app1.host, referral_acc: 'app2', commission: 0.05,
      });
      expect(payables.length).to.be.eq(4);
      expect(payables[0].account).to.be.eq(reviwer);
      expect(payables[0].amount).to.be.eq(10);
      expect(payables[1].account).to.be.eq(app1.app_commissions.campaigns_server_acc);
      expect(payables[1].amount).to.be.eq(0.2);
      expect(payables[1].type).to.be.eq('campaign_server_fee');
      expect(payables[2].account).to.be.eq(app1.app_commissions.index_commission_acc);
      expect(payables[2].amount).to.be.eq(0.03);
      expect(payables[3].account).to.be.eq('app2');
      expect(payables[3].amount).to.be.eq(0.27);
      expect(payables[3].type).to.be.eq('referral_server_fee');
    });

    it('should not return referral payable if it = 0', async () => {
      const app2 = await AppFactory.Create({ name: 'app1', indexCommission: 1, campaignCommission: 0.5 });
      const { payables } = await distributeReward({
        reviwer, reward: 10, server_acc: app2.host, referral_acc: 'app', commission: 0.05,
      });
      const referralPayment = _.find(payables, (payable) => payable.account === 'app');
      expect(referralPayment).to.be.undefined;
    });

    it('should return eq index and campaign commission', async () => {
      const app2 = await AppFactory.Create({ indexCommission: 1, campaignCommission: 0.5 });
      const { payables } = await distributeReward({
        reviwer, reward: 10, server_acc: app2.host, referral_acc: 'app', commission: 0.05,
      });
      const indexPayment = _.find(payables,
        (payable) => payable.account === app.app_commissions.index_commission_acc);
      const campaignPayment = _.find(payables,
        (payable) => payable.account === app.app_commissions.campaigns_server_acc);
      expect(indexPayment).to.be.eq(campaignPayment);
    });

    it('return with maximum referral server fee', async () => {
      const app1 = await AppFactory.Create({ indexCommission: 0, campaignCommission: 0 });
      const { payables } = await distributeReward({
        reviwer, reward: 10, server_acc: app1.host, commission: 0.05,
      });
      const referralPayment = _.find(payables,
        (payable) => payable.account === app1.app_commissions.referral_commission_acc);
      expect(referralPayment.amount).to.be.eq(0.5);
    });

    it('return with maximum campaign server fee', async () => {
      const app1 = await AppFactory.Create({ indexCommission: 1, campaignCommission: 1 });
      const { payables } = await distributeReward({
        reviwer, reward: 10, server_acc: app1.host, commission: 0.05,
      });
      const campaignPayment = _.find(payables,
        (payable) => payable.account === app1.app_commissions.campaigns_server_acc);
      expect(campaignPayment.amount).to.be.eq(0.5);
    });
    it('should not create index fee if campaign fee eq 1', async () => {
      const app1 = await AppFactory.Create({ indexCommission: 1, campaignCommission: 1 });
      const { payables } = await distributeReward({
        reviwer, reward: 10, server_acc: app1.host, commission: 0.05,
      });
      const indexPayment = _.find(payables,
        (payable) => payable.account === app1.app_commissions.index_commission_acc);
      expect(indexPayment).to.be.undefined;
    });
    it('return with app fee and one beneficiar', async () => {
      const { payables } = await distributeReward({
        reviwer,
        reward: 10,
        server_acc: app.host,
        beneficiaries,
        commission: 0.05,
      });
      expect(payables.length).to.be.eq(5);
      expect(payables[0].account).to.be.eq(reviwer);
      expect(payables[0].amount).to.be.eq(9);
      expect(payables[4].account).to.be.eq(beneficiar1);
      expect(payables[4].amount).to.be.eq(1);
    });
    it('return with app fee and two beneficiaries', async () => {
      beneficiaries.push({ account: beneficiar2, weight: 2500 });
      const { payables } = await distributeReward({
        reviwer,
        reward: 10,
        server_acc: app.host,
        beneficiaries,
        commission: 0.05,
      });
      expect(payables.length).to.be.eq(6);
      expect(payables[0].account).to.be.eq(reviwer);
      expect(payables[0].amount).to.be.eq(6.5);
      expect(payables[1].account).to.be.eq(app.app_commissions.campaigns_server_acc);
      expect(payables[1].amount).to.be.eq(0.15);
      expect(payables[2].account).to.be.eq(app.app_commissions.index_commission_acc);
      expect(payables[2].amount).to.be.eq(0.07);
      expect(payables[3].account).to.be.eq(app.app_commissions.referral_commission_acc);
      expect(payables[3].amount).to.be.eq(0.28);
      expect(payables[4].account).to.be.eq(beneficiar1);
      expect(payables[4].amount).to.be.eq(1);
      expect(payables[5].account).to.be.eq(beneficiar2);
      expect(payables[5].amount).to.be.eq(2.5);
    });
    it('check only waivio reward with maximum commission', async () => {
      const { payables } = await distributeReward({ reviwer, reward: 10, commission: 1 });
      expect(payables.length).to.be.eq(4);
      expect(payables[0].account).to.be.eq(reviwer);
      expect(payables[0].amount).to.be.eq(10);
      expect(payables[1].amount).to.be.eq(3);
    });
    it('check waivio and app rewards with maximum commission', async () => {
      const app1 = await AppFactory.Create();
      await UserFactory.Create({
        followers_count: 10,
        count_posts: 10,
        name: reviwer,
        referral: {
          type: REFERRAL_TYPES.REWARDS,
          endedAt: moment.utc().add(10, 'days').toDate(),
          agent: 'app',
        },
      });
      const { payables } = await distributeReward({
        reviwer, reward: 10, server_acc: app1.host, referral_acc: 'app', commission: 1,
      });
      expect(payables.length).to.be.eq(4);
      expect(payables[0].account).to.be.eq(reviwer);
      expect(payables[0].amount).to.be.eq(10);
      expect(payables[1].amount).to.be.eq(3);
      expect(payables[2].amount).to.be.eq(1.4);
      expect(payables[3].account).to.be.eq('app');
      expect(payables[3].amount).to.be.eq(5.6);
    });
  });

  describe('Review', async () => {
    describe('create review', async () => {
      let objects = ['obj1', 'obj2', 'obj3'], waivio;

      beforeEach(async () => {
        waivio = 'waivio.index';
        await dropDatabase();
        for (let i = 0; i < 3; i++) {
          const user = {
            status: 'assigned',
            name: `user${i + 1}`,
            object_permlink: objects[i % 3],
            permlink: 'permlink',
            hiveCurrency: 1,
          };

          await CampaignFactory.Create({
            guideName: 'sponsor1', status: 'active', users: [user], objects, permlink: `permlink${i + 1}`,
          });
        }

        await CampaignFactory.Create({
          guideName: 'sponsor2',
          status: 'active',
          users: [{
            status: 'assigned',
            name: 'user2',
            object_permlink: objects[0],
            permlink: 'permlink',
            hiveCurrency: 1,
          }],
          objects,
          permlink: 'permlink4',
        });

        await campaignsForPayments(objects);

        await CampaignFactory.Create({
          guideName: 'sponsor2',
          status: 'active',
          users: [{
            status: 'assigned',
            name: 'user1',
            object_permlink: objects[0],
            permlink: 'permlink',
            hiveCurrency: 1,
          }, {
            status: 'assigned',
            name: 'user2',
            object_permlink: objects[0],
            permlink: 'permlink',
            hiveCurrency: 1,
          },
          ],
          objects,
          permlink: 'permlink9',
        });
        const _id = new ObjectID();
        await CampaignFactory.Create({
          status: 'active',
          users: [{
            _id,
            status: 'completed',
            name: 'user3',
            object_permlink: objects[2],
            permlink: 'permlink',
            hiveCurrency: 1,
          }, {
            status: 'assigned',
            name: 'user3',
            object_permlink: objects[2],
            permlink: 'permlink',
            hiveCurrency: 1,
          },
          ],
          payments: [{
            reservationId: _id,
            userName: 'user3',
            rootAuthor: 'user3',
            objectPermlink: 'obj3',
            postTitle: 'title',
            postPermlink: 'postPermink',
            status: 'rejected',
          }],
          objects,
          permlink: 'permlink9',
        });

        await CampaignFactory.Create({
          status: 'active',
          users: [{
            status: 'assigned',
            name: 'user2',
            object_permlink: objects[0],
            permlink: 'permlink',
            hiveCurrency: 1,
          }],
          payments: [{
            reservationId: new ObjectID(),
            userName: 'user2',
            rootAuthor: 'user2',
            objectPermlink: 'obj1',
            postTitle: 'title',
            postPermlink: 'postPermink',
          }],
          objects,
          permlink: 'permlink10',
        });
      });

      describe('find', async () => {
        it('should return campaigns by exist object', async () => {
          const campaigns = await paymentsHelper.findReviewCampaigns({
            userName: 'user1',
            objects: ['obj1', 'obj2'],
          });
          expect(campaigns.length).to.be.eq(2);
        });
        it('check campaign server', async () => {
          const campaigns = await paymentsHelper.findReviewCampaigns({
            userName: 'user1',
            objects: ['obj1', 'obj2'],
          });
          expect(campaigns[0].campaign_server).to.be.exist;
        });
        it('should return campaigns by with unassign', async () => {
          const campaigns = await paymentsHelper.findReviewCampaigns({ userName: 'user1', objects: ['obj1'] });
          expect(campaigns.length).to.be.eq(2);
        });
        it('should return campaigns by non exist object', async () => {
          const campaigns = await paymentsHelper.findReviewCampaigns({ userName: 'user1', objects: ['obj3'] });
          expect(campaigns.length).to.be.eq(0);
        });
        it('should not return campaigns by non exist object', async () => {
          const campaigns = await paymentsHelper.findReviewCampaigns({ userName: 'user4', objects: ['obj1'] });
          expect(campaigns.length).to.be.eq(0);
        });
        it('should return campaigns with completed users', async () => {
          const campaigns = await paymentsHelper.findReviewCampaigns({ userName: 'user3', objects: ['obj3'] });
          expect(campaigns.length).to.be.eq(2);
        });
      });

      describe('create', async () => {
        describe('create with match bots', async () => {
          const match_bots = ['bot1', 'bot2'];
          const sponsor = 'sponsor1';
          const user = 'user1';

          beforeEach(async () => {
            await dropDatabase();
            await CampaignFactory.Create({
              guideName: sponsor,
              status: 'active',
              users: [{
                status: 'assigned',
                name: user,
                object_permlink: 'obj1',
                permlink: 'permlink',
                hiveCurrency: 1,
              },
              ],
              objects: ['obj1'],
              match_bots,
              permlink: 'activation_permlink',
              app: 'campaign_server',
            });
          });

          it('should create review payment with payed false', async () => {
            const objects = ['obj1'];
            const campaigns = await paymentsHelper.findReviewCampaigns({ userName: user, objects });
            await paymentsHelper.createReview({
              campaigns,
              objects,
              permlink: 'payment_permlink',
              title: 'title',
              app: 'app',
            });
            const payment = await PaymentHistory.findOne({ type: 'review' }).lean();
            expect(payment.payed).to.be.eq(false);
          });

          describe('with remaining > amount', async () => {
            let transfer;
            beforeEach(async () => {
              const objects = ['obj1'];
              const campaigns = await paymentsHelper.findReviewCampaigns({ userName: user, objects });
              transfer = await PaymentHistoryFactory.Create({
                sponsor: campaigns[0].guideName, userName: user, type: 'transfer', remaining: campaigns[0].reward, amount: campaigns[0].reward,
              });
              await paymentsHelper.createReview({
                campaigns,
                objects,
                permlink: 'payment_permlink',
                title: 'title',
                app: 'app',
              });
            });
            it('should create payment with payed true', async () => {
              const payment = await PaymentHistory.findOne({ type: 'review' }).lean();
              expect(payment.payed).to.be.true;
            });
            it('should update transfer with status payed', async () => {
              const payment = await PaymentHistory.findOne({ _id: transfer._id }).lean();
              expect(payment.payed).to.be.true;
            });
            it('should update transfer remaining to 0', async () => {
              const payment = (await PaymentHistory.findOne({ _id: transfer._id })).toJSON();
              expect(payment.details.remaining).to.be.eq(0);
            });
          });
          describe('with remaining < amount', async () => {
            let transfer, remaining;
            beforeEach(async () => {
              const objects = ['obj1'];
              const campaigns = await paymentsHelper.findReviewCampaigns({ userName: user, objects });
              remaining = campaigns[0].reward - 1;
              transfer = await PaymentHistoryFactory.Create({
                sponsor: campaigns[0].guideName, userName: user, type: 'transfer', remaining, amount: campaigns[0].reward,
              });
              await paymentsHelper.createReview({
                campaigns,
                objects,
                permlink: 'payment_permlink',
                title: 'title',
                app: 'app',
              });
            });
            it('should create payment with payed false', async () => {
              const payment = (await PaymentHistory.findOne({ type: 'review' })).toJSON();
              expect(payment.payed).to.be.false;
            });
            it('should not update transfer with status payed', async () => {
              const payment = (await PaymentHistory.findOne({ _id: transfer._id })).toJSON();
              expect(payment.payed).to.be.false;
            });
            it('should not update transfer remaining to 0', async () => {
              const payment = (await PaymentHistory.findOne({ _id: transfer._id })).toJSON();
              expect(payment.details.remaining).to.be.eq(remaining);
            });
          });

          it('check estimation payable with one match bot without match bot records', async () => {
            const objects = ['obj1'];
            const campaigns = await paymentsHelper.findReviewCampaigns({ userName: user, objects });
            await paymentsHelper.createReview({
              campaigns,
              objects,
              permlink: 'payment_permlink',
              title: 'title',
              app: 'app',
            });
            const botUpvotes = await BotUpvote.find();

            expect(botUpvotes.length).to.be.eq(0);
          });

          it('check creation rewiew with owner account', async () => {
            const objects = ['obj1'];
            const campaigns = await paymentsHelper.findReviewCampaigns({ userName: user, objects });
            await paymentsHelper.createReview({
              campaigns,
              objects,
              permlink: 'payment_permlink',
              title: 'title',
              app: 'app',
              owner_account: 'bot1',
            });
            const histories = await PaymentHistory.find();

            expect(histories[0].is_demo_account).to.be.eq(true);
            expect(histories[1].is_demo_account).to.be.eq(true);
          });

          it('check creation rewiew without owner account', async () => {
            const objects = ['obj1'];
            const campaigns = await paymentsHelper.findReviewCampaigns({ userName: user, objects });
            await paymentsHelper.createReview({
              campaigns,
              objects,
              permlink: 'payment_permlink',
              title: 'title',
              app: 'app',
            });
            const histories = await PaymentHistory.find();

            expect(histories[0].is_demo_account).to.be.eq(false);
            expect(histories[1].is_demo_account).to.be.eq(false);
          });

          it('check user status with one user', async () => {
            const objects = ['obj1'];
            const campaigns = await paymentsHelper.findReviewCampaigns({ userName: user, objects });

            await paymentsHelper.createReview(
              {
                campaigns,
                objects,
                permlink: 'payment_permlink',
                title: 'title',
                app: 'app',
              },
            );
            const Campaign1 = await Campaign.find();

            expect(Campaign1[0].users[0].status).to.be.eq('completed');
            expect(Campaign1[0].users[0].completedAt).to.be.exist;
          });

          it('check user status with many users', async () => {
            await dropDatabase();
            await CampaignFactory.Create({
              guideName: sponsor,
              status: 'active',
              users: [{
                status: 'assigned',
                name: 'new_user1',
                object_permlink: 'obj1',
                permlink: 'permlink1',
                hiveCurrency: 1,
              }, {
                status: 'assigned',
                name: user,
                object_permlink: 'obj1',
                permlink: 'permlink2',
                hiveCurrency: 1,
              }, {
                status: 'completed',
                name: 'new_user2',
                object_permlink: 'obj1',
                permlink: 'permlink3',
                hiveCurrency: 1,
              }, {
                status: 'assigned',
                name: 'new_user3',
                object_permlink: 'obj1',
                permlink: 'permlink4',
                hiveCurrency: 1,
              }],
              objects: ['obj1'],
              match_bots,
              permlink: 'activation_permlink',
            });

            const objects = ['obj1'];
            const campaigns = await paymentsHelper.findReviewCampaigns({ userName: user, objects });

            await paymentsHelper.createReview({
              campaigns,
              objects,
              permlink: 'payment_permlink',
              title: 'title',
              app: 'app',
            });
            const Campaign1 = await Campaign.find();
            expect(Campaign1[0].users[0].status).to.be.eq('assigned');
            expect(Campaign1[0].users[1].status).to.be.eq('completed');
            expect(Campaign1[0].users[1].completedAt).to.be.exist;
            expect(Campaign1[0].users[2].status).to.be.eq('completed');
            expect(Campaign1[0].users[3].status).to.be.eq('assigned');
          });
          it('check estimation payable with one match bot with not enabled match bot records', async () => {
            const objects = ['obj1'];
            await MatchBotFactory.Create({ bot_name: match_bots[0], sponsor, enabled: false });
            await MatchBotFactory.Create({ bot_name: match_bots[1], sponsor, enabled: false });
            const campaigns = await paymentsHelper.findReviewCampaigns({ userName: user, objects });
            await paymentsHelper.createReview({
              campaigns,
              objects,
              permlink: 'payment_permlink',
              title: 'title',
              app: 'app',
            });
            const botUpvotes = await BotUpvote.find();
            expect(botUpvotes.length).to.be.eq(0);
          });
          it('check estimation payable with one enabled match bot records and one disabled', async () => {
            const objects = ['obj1'];
            await MatchBotFactory.Create({ bot_name: match_bots[0], sponsor, enabled: true });
            await MatchBotFactory.Create({ bot_name: match_bots[1], sponsor, enabled: false });
            const campaigns = await paymentsHelper.findReviewCampaigns({ userName: user, objects });
            await paymentsHelper.createReview({
              campaigns,
              objects,
              permlink: 'payment_permlink',
              title: 'title',
              app: 'app',
            });
            const botUpvotes = await BotUpvote.find();
            expect(botUpvotes.length).to.be.eq(1);
          });
          it('check estimation payable with two approved match bot', async () => {
            const objects = ['obj1'];
            await MatchBotFactory.Create({ bot_name: match_bots[0], sponsor, enabled: true });
            await MatchBotFactory.Create({ bot_name: match_bots[1], sponsor, enabled: true });
            const campaigns = await paymentsHelper.findReviewCampaigns({ userName: user, objects });
            await paymentsHelper.createReview({
              campaigns,
              objects,
              permlink: 'payment_permlink',
              title: 'title',
              app: 'app',
            });
            const botUpvotes = await BotUpvote.find();
            expect(botUpvotes.length).to.be.eq(2);
          });
          it('check Bot Upvote fields', async () => {
            const objects = ['obj1'];
            const bot = await MatchBotFactory.Create(
              { bot_name: match_bots[0], sponsor, enabled: true },
            );
            await MatchBotFactory.Create({ bot_name: match_bots[1], sponsor, enabled: false });
            const campaigns = await paymentsHelper.findReviewCampaigns({ userName: user, objects });
            await paymentsHelper.createReview({
              campaigns,
              objects,
              permlink: 'payment_permlink',
              title: 'title',
              app: 'app',
            });
            const botUpvotes = await BotUpvote.find();
            expect(botUpvotes[0].botName).to.be.eql(bot.bot_name);
            expect(botUpvotes[0].author).to.be.eq(user);
            expect(botUpvotes[0].permlink).to.be.eq('payment_permlink');
            expect(moment.utc(botUpvotes[0].startedAt).format('LLLL')).to.be.eq(moment.utc().add(30, 'minutes').format('LLLL'));
            expect(moment.utc(botUpvotes[0].expiredAt).format('LLLL')).to.be.eq(moment.utc().add(7, 'days').format('LLLL'));
          });
        });

        describe('create with app commissions', async () => {
          beforeEach(async () => {
            await dropDatabase();
            await CampaignFactory.Create({
              status: 'active',
              users: [{
                status: 'assigned',
                name: 'user1',
                object_permlink: 'obj1',
                permlink: 'permlink',
                referral_server: 'referral_acc1',
                hiveCurrency: 1,
              }],
              objects: ['obj1'],
              permlink: 'permlink5',
              app: 'app1',
            });
            await CampaignFactory.Create({
              status: 'active',
              users: [{
                status: 'assigned',
                name: 'user1',
                object_permlink: 'obj1',
                permlink: 'permlink',
                referral_server: 'referral_acc2',
                hiveCurrency: 1,
              }],
              objects: ['obj1'],
              permlink: 'permlink5',
              app: 'app2',
            });
          });
          it('check app fee payment histories', async () => {
            const objects = ['obj1'];
            const campaigns = await paymentsHelper.findReviewCampaigns({ userName: 'user1', objects });
            await paymentsHelper.createReview({
              campaigns,
              objects,
              permlink: 'payment_permlink',
              title: 'title',
              app: 'app',
            });
            const histories = _.map(await PaymentHistory.find({ type: { $in: ['campaign_server_fee', 'referral_server_fee'] } }), (payment) => payment.toJSON());

            expect(histories.length).to.be.eq(4);
            expect(histories[0].amount).to.be.eq(0.158);
            expect(histories[0].userName).to.be.eq('waivio.campaigns');
            expect(histories[1].amount).to.be.eq(0.294);
            expect(histories[1].userName).to.be.eq('waivio.referrals');
            expect(histories[2].amount).to.be.eq(0.158);
            expect(histories[2].userName).to.be.eq('waivio.campaigns');
            expect(histories[3].amount).to.be.eq(0.294);
            expect(histories[3].userName).to.be.eq('waivio.referrals');
          });
        });

        it('check reviewers payment histories with beneficiaries', async () => {
          const objects = ['obj1'];
          const campaigns = await paymentsHelper.findReviewCampaigns({ userName: 'user1', objects });

          await paymentsHelper.createReview({
            campaigns,
            objects,
            permlink: 'payment_permlink',
            title: 'title',
            app: 'app',
            beneficiaries: [
              { account: 'b1', weight: 400 },
              { account: 'b2', weight: 1400 },
            ],
          });
          const beneficiaryHistories = await PaymentHistory.find({ type: 'beneficiary_fee' });
          const reviewHistories = await PaymentHistory.find({ type: 'review' });
          const beneficiarySum = sumBy(beneficiaryHistories, (history) => history.amount);
          const reviewerSum = sumBy(reviewHistories, (history) => history.amount);
          expect(reviewHistories.length).to.be.eq(2);
          expect(beneficiarySum).to.be.eq(3.78);
          expect(reviewerSum).to.be.eq(17.22);
          expect(reviewerSum / 21).to.be.eq(0.82);
          expect(beneficiarySum / 21).to.be.eq(0.18);
        });
        it('check review payment histories', async () => {
          const objects = ['obj1'];
          const campaigns = await paymentsHelper.findReviewCampaigns({ userName: 'user1', objects });
          await paymentsHelper.createReview(
            {
              campaigns,
              objects,
              permlink: 'payment_permlink',
              title: 'title',
              app: 'app',
            },
          );
          const histories = _.map(await PaymentHistory.find({ type: 'review' }), (payment) => payment.toJSON());
          expect(histories.length).to.be.eq(2);
          expect(histories[0].amount).to.be.eq(10.5);
          expect(histories[0].userName).to.be.eq('user1');
          expect(histories[1].amount).to.be.eq(10.5);
          expect(histories[1].userName).to.be.eq('user1');
        });
        it('check review payment histories with server account', async () => {
          const objects = ['obj1'];
          const campaigns = await paymentsHelper.findReviewCampaigns({ userName: 'user1', objects });
          await paymentsHelper.createReview({
            campaigns,
            objects,
            permlink: 'payment_permlink',
            title: 'title',
            app: 'app',
          });
          const histories = _.map(await PaymentHistory.find(), (payment) => payment.toJSON());
          expect(histories.length).to.be.eq(8);
          expect(histories[0].userName).to.be.eq('user1');
          expect(histories[0].amount).to.be.eq(10.5);
          expect(histories[1].userName).to.be.eq('waivio.campaigns');
          expect(histories[1].amount).to.be.eq(0.158);
          expect(histories[2].userName).to.be.eq('waivio.index');
          expect(histories[2].amount).to.be.eq(0.073);
          expect(histories[3].userName).to.be.eq('waivio.referrals');
          expect(histories[3].amount).to.be.eq(0.294);
          expect(histories[4].userName).to.be.eq('user1');
          expect(histories[4].amount).to.be.eq(10.5);
        });

        it('check waivio fee payment histories', async () => {
          const objects = ['obj1'];
          const campaigns = await paymentsHelper.findReviewCampaigns({ userName: 'user1', objects });
          await paymentsHelper.createReview({
            campaigns,
            objects,
            permlink: 'payment_permlink',
            title: 'title',
            app: 'app',
          });
          const histories = _.map(await PaymentHistory.find({ type: 'index_fee' }), (payment) => payment.toJSON());
          expect(histories.length).to.be.eq(2);
          expect(histories[0].amount).to.be.eq(0.073);
          expect(histories[0].userName).to.be.eq(waivio);
          expect(histories[1].amount).to.be.eq(0.073);
          expect(histories[1].userName).to.be.eq(waivio);
        });
        it('check beneficiaries fee payment histories with beneficiaries', async () => {
          const objects = ['obj1'];
          const campaigns = await paymentsHelper.findReviewCampaigns({ userName: 'user1', objects });
          await paymentsHelper.createReview({
            campaigns,
            objects,
            permlink: 'payment_permlink',
            title: 'title',
            app: 'app',
            beneficiaries: [
              { account: 'b1', weight: 400 },
              { account: 'b2', weight: 1400 },
            ],
          });
          const histories = _.map(await PaymentHistory.find({ type: 'beneficiary_fee' }), (payment) => payment.toJSON());
          expect(histories.length).to.be.eq(4);
          expect(histories[0].amount).to.be.eq(0.42);
          expect(histories[1].amount).to.be.eq(1.47);
          expect(histories[0].userName).to.be.eq('b1');
          expect(histories[1].userName).to.be.eq('b2');
        });
        it('check beneficiaries fee payment histories with beneficiaries and app accounts', async () => {
          const objects = ['obj1'];
          const campaigns = await paymentsHelper.findReviewCampaigns({ userName: 'user1', objects });
          await paymentsHelper.createReview({
            campaigns,
            objects,
            permlink: 'payment_permlink',
            title: 'title',
            app: 'app',
            app_account: 'eugenezh',
            beneficiaries: [
              { account: 'b1', weight: 400 },
              { account: 'b2', weight: 1400 },
            ],
          });
          const histories = _.map(await PaymentHistory.find({ type: 'beneficiary_fee' }), (payment) => payment.toJSON());
          expect(histories.length).to.be.eq(4);
          expect(histories[0].amount).to.be.eq(0.42);
          expect(histories[1].amount).to.be.eq(1.47);
          expect(histories[0].userName).to.be.eq('b1');
          expect(histories[1].userName).to.be.eq('b2');
        });

        it('should create payments to many campaigns', async () => {
          const objects = ['obj1'];
          const campaigns = await paymentsHelper.findReviewCampaigns({ userName: 'user1', objects });
          await paymentsHelper.createReview({
            campaigns,
            objects,
            permlink: 'payment_permlink',
            title: 'title',
            app: 'app',
          });
          const campaignsWithPayments = await Campaign.find({ 'payments.postPermlink': 'payment_permlink' });
          expect(campaigns.length).to.be.eq(2);
          expect(campaignsWithPayments.length).to.be.eq(campaigns.length);
        });

        it('should create payments with exists payed payments', async () => {
          const objects = ['obj3'];
          const campaigns = await paymentsHelper.findReviewCampaigns({ userName: 'user3', objects });
          await paymentsHelper.createReview({
            campaigns,
            objects,
            permlink: 'payment_permlink',
            title: 'title',
            app: 'app',
          });
          const campaignsWithPayments = await Campaign.find({ 'payments.postPermlink': 'payment_permlink' });
          expect(campaigns.length).to.be.eq(2);
          expect(campaignsWithPayments.length).to.be.eq(campaigns.length);
          expect(campaignsWithPayments[0].payments.length).to.be.eq(1);
          expect(campaignsWithPayments[1].payments.length).to.be.eq(2);
          expect(campaignsWithPayments[1].payments[0].status).to.be.eq('rejected');
          expect(campaignsWithPayments[1].payments[1].status).to.be.eq('active');
        });

        it('should create payments with exists pending payments', async () => {
          const objects = ['obj1'];
          const campaigns = await paymentsHelper.findReviewCampaigns({ userName: 'user2', objects });
          await paymentsHelper.createReview({
            campaigns,
            objects,
            permlink: 'payment_permlink',
            title: 'title',
            app: 'app',
          });
          const campaignsWithPayments = await Campaign.find({ 'payments.postPermlink': 'payment_permlink' });
          expect(campaigns.length).to.be.eq(3);
          expect(campaignsWithPayments.length).to.be.eq(campaigns.length);
          expect(campaignsWithPayments[0].payments.length).to.be.eq(1);
          expect(campaignsWithPayments[1].payments.length).to.be.eq(1);
        });
        it('should not create payments with another objects', async () => {
          const objects = ['obj1', 'obj11'];
          const campaigns = await paymentsHelper.findReviewCampaigns({ userName: 'user2', objects });
          await paymentsHelper.createReview({
            campaigns,
            objects,
            permlink: 'payment_permlink',
            title: 'title',
            app: 'app',
          });
          const campaignsWithPayments = await Campaign.find({ 'payments.postPermlink': 'payment_permlink' });
          expect(campaigns.length).to.be.eq(3);
          expect(campaignsWithPayments.length).to.be.eq(campaigns.length);
          expect(campaignsWithPayments[0].payments.length).to.be.eq(1);
          expect(campaignsWithPayments[1].payments.length).to.be.eq(1);
        });
      });
    });

    describe('transfer for payable', async () => {
      beforeEach(async () => {
        await dropDatabase();
      });
      it('check payment history', async () => {
        await paymentsHelper.transfer({
          permlink: 'permlink', userName: 'user1', sponsor: 'guide1', amount: '13.2 SBD',
        });
        const history = _.map(await PaymentHistory.find(), (payment) => payment.toJSON());
        expect(history.length).to.be.eq(1);
        expect(history[0].amount).to.be.eq(13.2);
        expect(history[0].userName).to.be.eq('user1');
        expect(history[0].details.transfer_permlink).to.be.eq('permlink');
        expect(history[0].sponsor).to.be.eq('guide1');
      });
    });

    describe('create payment history', async () => {
      beforeEach(async () => {
        await dropDatabase();
      });
      it('return success with review type', async () => {
        const { result } = await paymentHistoryModel.addPaymentHistory({
          campaign: { userReservationPermlink: 'userReservationPermlink', requiredObject: 'requiredObject' },
          userName: 'user1',
          app: 'app',
          type: 'review',
          payable: 10.5,
          review_permlink: 'permlink',
          object_permlink: 'review_object',
        });
        expect(result).to.be.true;
      });
      it('check transfer details', async () => {
        await paymentHistoryModel.addPaymentHistory({
          transfer_permlink: 'permlink',
          sponsor: 'sponsor',
          userName: 'user1',
          app: 'app',
          type: 'transfer',
          payable: 10.5,
        });
        const reviewHistory = await PaymentHistory.findOne({ userName: 'user1', type: 'transfer' });

        expect(reviewHistory.details.transfer_permlink).to.be.eq('permlink');
        expect(reviewHistory.sponsor).to.be.eq('sponsor');
      });

      it('check review details', async () => {
        await paymentHistoryModel.addPaymentHistory({
          userReservationPermlink: 'userReservationPermlink',
          requiredObject: 'requiredObject',
          userName: 'user1',
          app: 'app',
          type: 'review',
          payable: 10.5,
          review_permlink: 'permlink',
          object_permlink: 'review_object',
        });
        const reviewHistory = await PaymentHistory.findOne({ userName: 'user1', type: 'review' });

        expect(reviewHistory.details.review_permlink).to.be.eq('permlink');
        expect(reviewHistory.details.reservation_permlink).to.be.eq('userReservationPermlink');
        expect(reviewHistory.details.main_object).to.be.eq('requiredObject');
        expect(reviewHistory.details.review_object).to.be.eq('review_object');
      });

      it('return success without app', async () => {
        const { result } = await paymentHistoryModel.addPaymentHistory({
          userReservationPermlink: 'userReservationPermlink',
          requiredObject: 'requiredObject',
          userName: 'user1',
          type: 'review',
          payable: 10.5,
          review_permlink: 'permlink',
          object_permlink: 'review_object',
        });
        expect(result).to.be.true;
      });
      it('return success with transfer type', async () => {
        const { result } = await paymentHistoryModel.addPaymentHistory({
          sponsor: 'sponsor', userName: 'user1', app: 'app', type: 'transfer', payable: 10.5,
        });
        expect(result).to.be.true;
      });
      it('return error with invalid type', async () => {
        const { result } = await paymentHistoryModel.addPaymentHistory({
          campaign: { userReservationPermlink: 'userReservationPermlink', requiredObject: 'requiredObject' },
          userName: 'user1',
          app: 'app',
          type: 'aaa',
          payable: 10.5,
          review_permlink: 'permlink',
          object_permlink: 'review_object',
        });
        expect(result).to.be.false;
      });

      it('return error without type', async () => {
        const { result } = await paymentHistoryModel.addPaymentHistory({
          campaign: { userReservationPermlink: 'userReservationPermlink', requiredObject: 'requiredObject' },
          userName: 'user1',
          app: 'app',
          type: 'aaa',
          payable: 10.5,
          review_permlink: 'permlink',
          object_permlink: 'review_object',
        });
        expect(result).to.be.false;
      });
      it('return error with invalid payable', async () => {
        const { result } = await paymentHistoryModel.addPaymentHistory({
          campaign: { userReservationPermlink: 'userReservationPermlink', requiredObject: 'requiredObject' },
          userName: 'user1',
          app: 'app',
          type: 'review',
          payable: 'a',
          review_permlink: 'permlink',
          object_permlink: 'review_object',
        });
        expect(result).to.be.false;
      });
      it('return error without payable', async () => {
        const { result } = await paymentHistoryModel.addPaymentHistory({
          campaign: { userReservationPermlink: 'userReservationPermlink', requiredObject: 'requiredObject' },
          userName: 'user1',
          app: 'app',
          type: 'review',
          review_permlink: 'permlink',
          object_permlink: 'review_object',
        });
        expect(result).to.be.false;
      });
    });
  });
});
