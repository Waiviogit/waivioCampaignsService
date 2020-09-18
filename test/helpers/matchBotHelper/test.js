const {
  matchBotHelper, expect, sinon, dropDatabase, moment, _, Constants,
  steemHelper, BotUpvote, PaymentHistory, MatchBot, faker,
} = require('test/testHelper');
const {
  MatchBotFactory, BotUpvoteFactory, PostFactory, PaymentHistoryFactory, CampaignFactory,
} = require('test/factories');

describe('matchBotHelper', async () => {
  describe('payableRecount', async () => {
    let sponsor1, sponsor2, botName1, botName2, matchBot1, matchBot2, postInfo, priceInfo;

    beforeEach(async () => {
      await dropDatabase();
      botName1 = 'bot1';
      botName2 = 'bot2';
      sponsor1 = 'sponsor1';
      sponsor2 = 'sponsor2';
      matchBot1 = await MatchBotFactory.Create({ bot_name: botName1, sponsor: sponsor1 });
      matchBot2 = await MatchBotFactory.Create({ bot_name: botName2, sponsor: sponsor2 });
      postInfo = { active_votes: [{ voter: 'bot1', rshares: 4866678620000 }] };
      priceInfo = { amount: 0.4 };
    });

    afterEach(async () => {
      sinon.restore();
    });

    it('recount without upvotes', async () => {
      sinon.stub(steemHelper, 'getPostInfo').returns(Promise.resolve(postInfo));
      await matchBotHelper.executeRecount();
      const botUpvotes = await BotUpvote.find();
      expect(botUpvotes.length).to.be.eq(0);
    });

    it('recount with one upvote', async () => {
      const botUpvote = await BotUpvoteFactory.Create({
        author: 'author', bot_name: matchBot1.bot_name, sponsor: sponsor1, status: 'upvoted', currentVote: 0.4,
      });
      await PaymentHistoryFactory.Create({
        userName: 'author', sponsor: sponsor1, type: 'review', reviewPermlink: botUpvote.permlink, permlink: botUpvote.reservationPermlink,
      });

      sinon.stub(steemHelper, 'getPostInfo').returns(Promise.resolve(postInfo));
      await matchBotHelper.executeRecount();

      const paymentHistories = await PaymentHistory.find();
      const botUpvotes = await BotUpvote.find();

      expect(_.map(paymentHistories, 'amount')).to.be.eql([4.8]);
      expect(_.map(paymentHistories, 'recounted')).to.be.eql([true]);
      expect(botUpvotes.length).to.be.eq(1);
    });

    it('recount with one upvote and without bot vote', async () => {
      postInfo = { active_votes: { voter: 'aaa', rshares: 4866678620000 } };
      const botUpvote = await BotUpvoteFactory.Create({
        author: 'author', bot_name: matchBot1.bot_name, sponsor: sponsor1, status: 'upvoted',
      });
      await PaymentHistoryFactory.Create({
        userName: 'author', sponsor: sponsor1, type: 'review', reviewPermlink: botUpvote.permlink, permlink: botUpvote.reservationPermlink,
      });

      sinon.stub(steemHelper, 'getPostInfo').returns(Promise.resolve(postInfo));
      await matchBotHelper.executeRecount();

      const paymentHistories = await PaymentHistory.find();
      const botUpvotes = await BotUpvote.find();

      expect(_.map(paymentHistories, 'amount')).to.be.eql([5]);
      expect(_.map(paymentHistories, 'recounted')).to.be.eql([true]);
      expect(botUpvotes.length).to.be.eq(1);
    });

    it('recount with one upvote and without payment history', async () => {
      postInfo = { active_votes: { voter: 'aaa', rshares: 4866678620000 } };
      await BotUpvoteFactory.Create({
        author: 'author', bot_name: matchBot1.bot_name, sponsor: sponsor1, status: 'upvoted',
      });
      sinon.stub(steemHelper, 'getPostInfo').returns(Promise.resolve(postInfo));
      await matchBotHelper.executeRecount();
      const botUpvotes = await BotUpvote.find();

      expect(botUpvotes.length).to.be.eq(1);
    });

    it('recount with one upvote and upvote > amount', async () => {
      priceInfo = { amount: 7 };
      const botUpvote = await BotUpvoteFactory.Create({
        author: 'author', bot_name: matchBot1.bot_name, sponsor: sponsor1, status: 'upvoted', currentVote: 7,
      });
      await PaymentHistoryFactory.Create({
        userName: 'author', sponsor: sponsor1, type: 'review', reviewPermlink: botUpvote.permlink, amount: 1.5, permlink: botUpvote.reservationPermlink,
      });
      sinon.stub(steemHelper, 'getPostInfo').returns(Promise.resolve(postInfo));
      await matchBotHelper.executeRecount();
      const paymentHistories = await PaymentHistory.find();
      const botUpvotes = await BotUpvote.find();

      expect(_.map(paymentHistories, 'amount')).to.be.eql([0]);
      expect(_.map(paymentHistories, 'recounted')).to.be.eql([true]);
      expect(botUpvotes.length).to.be.eq(1);
    });

    it('recount with many upvotes', async () => {
      for (let i = 0; i < 3; i++) {
        const bot = await BotUpvoteFactory.Create({
          author: `author${i}`, bot_name: matchBot1.bot_name, sponsor: sponsor1, status: 'upvoted', currentVote: 0.4,
        });
        await PaymentHistoryFactory.Create({
          userName: `author${i}`, sponsor: sponsor1, type: 'review', reviewPermlink: bot.permlink, permlink: bot.reservationPermlink,
        });
      }
      sinon.stub(steemHelper, 'getPostInfo').returns(Promise.resolve(postInfo));
      await matchBotHelper.executeRecount();
      const paymentHistories = await PaymentHistory.find();
      const botUpvotes = await BotUpvote.find();

      expect(_.map(paymentHistories, 'amount')).to.be.eql([4.8, 4.8, 4.8]);
      expect(_.map(paymentHistories, 'recounted')).to.be.eql([true, true, true]);
      expect(botUpvotes.length).to.be.eq(3);
    });

    it('recount with many upvotes from many bots', async () => {
      postInfo = {
        active_votes: [
          { voter: 'bot1', rshares: 4866678620000 },
          { voter: 'bot2', rshares: 4866678620000 },
        ],
      };
      for (let i = 0; i < 3; i++) {
        const bot = await BotUpvoteFactory.Create({
          author: `author1${i}`, bot_name: matchBot1.bot_name, sponsor: sponsor1, status: 'upvoted',
        });
        await PaymentHistoryFactory.Create({
          userName: `author1${i}`,
          sponsor: sponsor1,
          reviewPermlink: bot.permlink,
          permlink: bot.reservationPermlink,
        });
      }
      for (let i = 0; i < 2; i++) {
        const bot = await BotUpvoteFactory.Create({
          author: `author2${i}`, bot_name: matchBot2.bot_name, sponsor: sponsor2, status: 'upvoted',
        });
        await PaymentHistoryFactory.Create({
          userName: `author2${i}`,
          sponsor: sponsor2,
          reviewPermlink: bot.permlink,
          permlink: bot.reservationPermlink,
        });
      }
      for (let i = 0; i < 4; i++) {
        const bot = await BotUpvoteFactory.Create({
          author: `author3${i}`, bot_name: matchBot1.bot_name, sponsor: sponsor2, status: 'pending',
        });
        await PaymentHistoryFactory.Create({
          userName: `author3${i}`,
          sponsor: sponsor2,
          reviewPermlink: bot.permlink,
          permlink: bot.reservationPermlink,
        });
      }
      sinon.stub(steemHelper, 'getPostInfo').returns(Promise.resolve(postInfo));
      await matchBotHelper.executeRecount();

      const paymentHistories = await PaymentHistory.find({ recounted: true });
      const botUpvotes = await BotUpvote.find();

      expect(paymentHistories.length).to.be.eql(5);
      expect(botUpvotes.length).to.be.eq(9);
    });
  });
  describe(' recount with beneficiaries ', async () => {
    let paymentHistories, payment, weight, priceInfo, payment2, payment3;
    beforeEach(async () => {
      await dropDatabase();
      weight = 1000;
      const beneficiaries = [
        { account: faker.name.firstName(), weight },
        { account: faker.name.firstName(), weight: weight * 2 },
      ];

      const matchBot = await MatchBotFactory.Create({});
      const botUpvote = await BotUpvoteFactory.Create({
        bot_name: matchBot.bot_name, status: 'upvoted', currentVote: 0.2,
      });
      payment = await PaymentHistoryFactory.Create({
        reviewPermlink: botUpvote.permlink,
        permlink: botUpvote.reservationPermlink,
        userName: botUpvote.author,
        sponsor: botUpvote.sponsor,
        beneficiaries,

      });
      payment2 = await PaymentHistoryFactory.Create({
        reviewPermlink: botUpvote.permlink,
        permlink: botUpvote.reservationPermlink,
        userName: beneficiaries[0].account,
        sponsor: botUpvote.sponsor,
        type: 'beneficiary_fee',
        amount: payment.amount * (weight / 10000),
        beneficiaries,
        weight,
      });
      payment3 = await PaymentHistoryFactory.Create({
        reviewPermlink: botUpvote.permlink,
        permlink: botUpvote.reservationPermlink,
        userName: beneficiaries[1].account,
        sponsor: botUpvote.sponsor,
        type: 'beneficiary_fee',
        amount: payment.amount * (weight * 2 / 10000),
        beneficiaries,
        weight,
      });
      const postInfo = {
        active_votes: [{ voter: matchBot.bot_name, rshares: 4866678620000 }],
      };
      priceInfo = { amount: 0.2 };
      sinon.stub(steemHelper, 'getPostInfo').returns(Promise.resolve(postInfo));
      await matchBotHelper.executeRecount();

      paymentHistories = await PaymentHistory.find({ recounted: true }).lean();
    });
    afterEach(async () => {
      sinon.restore();
    });
    it('should will be considered beneficiaries when recount review amount', async () => {
      const result = _.find(paymentHistories, (history) => history.type === 'review');
      const recounted = _.round(payment.amount - (priceInfo.amount * ((10000 - weight * 3) / 10000)) / 2, 4);
      expect(result.amount).to.be.eq(recounted);
    });
    it('should will be considered beneficiaries when recount first beneficiarie amount', async () => {
      const result = _.find(paymentHistories, (history) => history.userName === payment2.userName);
      const recounted = _.round(payment2.amount - (priceInfo.amount * ((weight) / 10000)) / 2, 4);
      expect(result.amount).to.be.eq(recounted);
    });
    it('should will be considered beneficiaries when recount second beneficiarie amount', async () => {
      const result = _.find(paymentHistories, (history) => history.userName === payment3.userName);
      const recounted = _.round(payment3.amount - (priceInfo.amount * ((weight * 2) / 10000)) / 2, 4);
      expect(result.amount).to.be.eq(recounted);
    });
  });
  describe('executeUpvotes', async () => {
    let sponsor, botUpvote1, botUpvote2, matchBot1, matchBot2, paymentHistory, bot3, voteWeight;

    beforeEach(async () => {
      bot3 = faker.name.firstName();
      sponsor = faker.name.firstName();
      voteWeight = 8;
      await dropDatabase();
      matchBot1 = await MatchBotFactory.Create({ enabled: true, sponsor });
      matchBot2 = await MatchBotFactory.Create({ enabled: true, sponsor });
      sinon.stub(steemHelper, 'getPostInfo').returns(Promise.resolve({ active_votes: [{ voter: matchBot1.bot_name }, { voter: bot3 }] }));
      botUpvote1 = await BotUpvoteFactory.Create({
        bot_name: matchBot1.bot_name, sponsor, createdAt: moment.utc().subtract(1, 'days'), reward: 10, amountToVote: 10,
      });
      paymentHistory = await PaymentHistoryFactory.Create({
        sponsor, userName: botUpvote1.author, type: 'review', reviewPermlink: botUpvote1.permlink, permlink: botUpvote1.reservationPermlink,
      });
      await PostFactory.Create(_.pick(botUpvote1, ['author', 'permlink']));
      botUpvote2 = await BotUpvoteFactory.Create({
        bot_name: matchBot1.bot_name, sponsor, author: botUpvote1.author, reward: 10, amountToVote: 10,
      });
      await PostFactory.Create(_.pick(botUpvote2, ['author', 'permlink']));
    });

    afterEach(async () => {
      sinon.restore();
    });
    describe('on Success', async () => {
      beforeEach(async () => {
        sinon.stub(steemHelper, 'getVotingInfo').returns(Promise.resolve({ currentVotePower: 9500, voteWeight }));
        sinon.stub(steemHelper, 'likePost').returns(Promise.resolve({ result: true }));
      });
      // describe('Compensation_fee payment', async () => {
      //   let payment, campaign;
      //   beforeEach(async () => {
      //     campaign = await CampaignFactory.Create({
      //       compensationAccount: faker.name.firstName(),
      //       users: [{
      //         name: `${faker.name.firstName()}${faker.random.number()}`,
      //         status: 'completed',
      //         object_permlink: 'obj1',
      //         hiveCurrency: 1,
      //         permlink: botUpvote1.reservationPermlink,
      //       }],
      //     });
      //     await matchBotHelper.executeUpvotes();
      //     payment = await PaymentHistory.findOne({ type: 'compensation_fee', 'details.reservation_permlink': botUpvote1.reservationPermlink }).lean();
      //   });
      //   it('should create compensation_fee if it not exist', async () => {
      //     expect(payment).to.be.exist;
      //   });
      //   it('should create compensation_fee with right userName', async () => {
      //     expect(payment.userName).to.be.eq(campaign.compensationAccount);
      //   });
      //   it('should create compensation_fee with right amount', async () => {
      //     expect(payment.amount).to.be.eq(voteWeight / 2);
      //   });
      // });
      describe('with many Bots', async () => {
        let botUpvote3, matchBot3, campaign, compensationAcc, users;
        beforeEach(async () => {
          compensationAcc = faker.name.firstName();
          users = [{
            name: botUpvote1.author,
            status: 'completed',
            hiveCurrency: 0.5,
            object_permlink: faker.random.string(),
            permlink: botUpvote1.reservationPermlink,
          }];
          campaign = await CampaignFactory.Create({
            guideName: sponsor, reward: 2.5, users, compensationAccount: compensationAcc,
          });
          matchBot3 = await MatchBotFactory.Create({
            bot_name: bot3, enabled: true, sponsor,
          });
          botUpvote3 = await BotUpvoteFactory.Create({
            bot_name: matchBot3.bot_name, sponsor, author: botUpvote1.author, reward: 10, amountToVote: 10, permlink: botUpvote1.permlink, reservationPermlink: botUpvote1.reservationPermlink,
          });
        });
        it('should call vote method with not full vote weight', async () => {
          await matchBotHelper.executeUpvotes();
          expect(steemHelper.likePost.args[1][0].weight).to.be.eq(10000);
        });
        // it('should not update compensation fee > reward', async () => {
        //   await matchBotHelper.executeUpvotes();
        //   const result = await PaymentHistory.findOne({ type: 'compensation_fee', userName: compensationAcc });
        //   expect(result.amount).to.be.eq(campaign.reward / users[0].hiveCurrency);
        // });
        it('should update payment history by all allowed upvote reward', async () => {
          await matchBotHelper.executeUpvotes();
          await matchBotHelper.executeRecount();
          const history = await PaymentHistory.findOne({ 'details.review_permlink': paymentHistory.details.review_permlink }).lean();
          expect(history.details.votesAmount).to.be.eq(paymentHistory.amount);
        });
      });
      it('success executes one upvote', async () => {
        await matchBotHelper.executeUpvotes();
        const pendingUpvotes = await BotUpvote.find({ status: 'pending' });
        expect(steemHelper.likePost.callCount).to.be.eq(1);
        expect(pendingUpvotes.length).to.be.eq(1);
      });
      it('should take voteAmount from payment history amount after vote', async () => {
        await matchBotHelper.executeUpvotes();
        await matchBotHelper.executeRecount();
        const history = await PaymentHistory.findOne({ 'details.review_permlink': paymentHistory.details.review_permlink }).lean();
        expect(history.amount).to.be.eq(paymentHistory.amount - voteWeight / 2);
      });
      it('should add to votesAmount vote weight after vote', async () => {
        await matchBotHelper.executeUpvotes();
        await matchBotHelper.executeRecount();
        const history = await PaymentHistory.findOne({ 'details.review_permlink': paymentHistory.details.review_permlink }).lean();
        expect(history.details.votesAmount).to.be.eq(voteWeight / 2);
      });
      it('success executes two async calls upvotes', async () => {
        await matchBotHelper.executeUpvotes();
        await matchBotHelper.executeUpvotes();
        const pendingUpvotes = await BotUpvote.find({ status: 'pending' });
        expect(steemHelper.likePost.callCount).to.be.eq(2);
        expect(pendingUpvotes.length).to.be.eq(0);
      });
      it('success executes one upvote per two bots', async () => {
        const upvote = await BotUpvoteFactory.Create({
          bot_name: matchBot2.bot_name, sponsor, author: botUpvote1.author,
        });
        await PostFactory.Create(_.pick(upvote, ['author', 'permlink']));
        await matchBotHelper.executeUpvotes();
        const pendingUpvotes = await BotUpvote.find({ status: 'pending' });

        expect(steemHelper.likePost.callCount).to.be.eq(2);
        expect(pendingUpvotes.length).to.be.eq(1);
      });

      it('success executes three async calls upvotes', async () => {
        const upvote = await BotUpvoteFactory.Create({
          bot_name: matchBot2.bot_name, sponsor, author: botUpvote1.author,
        });
        await PostFactory.Create(_.pick(upvote, ['author', 'permlink']));
        await matchBotHelper.executeUpvotes();
        await matchBotHelper.executeUpvotes();
        await matchBotHelper.executeUpvotes();
        const pendingUpvotes = await BotUpvote.find({ status: 'pending' });

        expect(steemHelper.likePost.callCount).to.be.eq(3);
        expect(pendingUpvotes.length).to.be.eq(0);
      });
    });
    it('success not executes if voting power lower than minimum', async () => {
      sinon.stub(steemHelper, 'getVotingInfo').returns(Promise.resolve({ currentVotePower: 7800 }));
      sinon.stub(steemHelper, 'likePost').returns(Promise.resolve({ success: true }));
      await matchBotHelper.executeUpvotes(10);
      const pendingUpvotes = await BotUpvote.find({ status: 'pending' });

      expect(steemHelper.likePost.callCount).to.be.eq(0);
      expect(pendingUpvotes.length).to.be.eq(2);
    });

    it('check voting percent', async () => {
      sinon.stub(steemHelper, 'getVotingInfo').returns(Promise.resolve({ currentVotePower: 8500, voteWeight: botUpvote2.reward }));
      sinon.stub(steemHelper, 'likePost').returns(Promise.resolve({ result: true }));
      await matchBotHelper.executeUpvotes();
      const pendingUpvotes = await BotUpvote.find({ status: 'pending' });

      expect(steemHelper.likePost.callCount).to.be.eq(1);
      expect(steemHelper.likePost.args[0][0].weight).to.be.eq(10000);
      expect(pendingUpvotes.length).to.be.eq(1);
    });

    it('check error from upvote', async () => {
      sinon.stub(steemHelper, 'getVotingInfo').returns(Promise.resolve({ currentVotePower: 8500 }));
      sinon.stub(steemHelper, 'likePost').throws('RPC error');
      const upvote = await BotUpvoteFactory.Create({
        bot_name: matchBot2.bot_name, sponsor, author: botUpvote1.author,
      });
      await PostFactory.Create(_.pick(upvote, ['author', 'permlink']));
      await matchBotHelper.executeUpvotes(50);
      const pendingUpvotes = await BotUpvote.find({ status: 'pending' });

      expect(steemHelper.likePost.callCount).to.be.eq(2);
      expect(pendingUpvotes.length).to.be.eq(3);
    });
  });

  describe('setMatchBot', async () => {
    let bot_name, sponsor, voting_percent, note, enabled, accsStub, expiredAt;

    beforeEach(async () => {
      await dropDatabase();
      bot_name = 'bot1';
      sponsor = 'sponsor1';
      voting_percent = 1;
      note = 'some notes';
      enabled = true;
      expiredAt = moment().utc().add(1, 'days').startOf('date')
        .toDate();
      accsStub = [
        { posting: { account_auths: [[0, Constants.upvoteBot.userName]] } },
        { posting: { account_auths: [] } },
      ];
    });

    afterEach(() => {
      sinon.restore();
    });

    it('check all fields', async () => {
      await sinon.stub(steemHelper, 'getAccountsInfo').returns(Promise.resolve(accsStub));
      await matchBotHelper.setRule({
        bot_name, sponsor, voting_percent, note, enabled, expiredAt,
      });
      const matchBots = await MatchBot.find();

      expect(matchBots.length).to.be.eq(1);
      expect(matchBots[0].bot_name).to.be.eq(bot_name);
      expect(matchBots[0].sponsors[0].enabled).to.be.true;
      expect(matchBots[0].sponsors[0].sponsor_name).to.be.eq(sponsor);
      expect(matchBots[0].sponsors[0].note).to.be.eq(note);
      expect(matchBots[0].sponsors[0].voting_percent).to.be.eq(voting_percent);
      expect(matchBots[0].sponsors[0].expiredAt).to.be.eql(expiredAt);
    });

    it('check update exist rule and enabled true', async () => {
      voting_percent = 0.2;
      await MatchBotFactory.Create({
        bot_name, sponsor, voting_percent, note, enabled, expiredAt,
      });
      await sinon.stub(steemHelper, 'getAccountsInfo').returns(Promise.resolve(accsStub));
      await matchBotHelper.setRule({
        bot_name, sponsor, voting_percent, note, enabled, expiredAt,
      });
      const matchBots = await MatchBot.find();

      expect(matchBots.length).to.be.eq(1);
      expect(matchBots[0].sponsors[0].enabled).to.be.true;
      expect(matchBots[0].sponsors[0].voting_percent).to.be.eq(voting_percent);
    });

    it('check update exist rule and enabled true and without posting authorize with bot', async () => {
      voting_percent = 0.2;
      accsStub[0].posting.account_auths = [[0, 'some_acc']];
      await MatchBotFactory.Create({
        bot_name, sponsor, voting_percent, note, enabled, expiredAt,
      });
      await sinon.stub(steemHelper, 'getAccountsInfo').returns(Promise.resolve(accsStub));
      await matchBotHelper.setRule({
        bot_name, sponsor, voting_percent, note, enabled, expiredAt,
      });
      const matchBots = await MatchBot.find();

      expect(matchBots.length).to.be.eq(1);
      expect(matchBots[0].sponsors[0].enabled).to.be.false;
      expect(matchBots[0].sponsors[0].voting_percent).to.be.eq(voting_percent);
    });

    it('should not update activation if expiredAt was ended ', async () => {
      voting_percent = 0.2;
      await MatchBotFactory.Create({
        bot_name, sponsor, voting_percent, note, enabled: false, expiredAt: moment().toDate(),
      });
      await sinon.stub(steemHelper, 'getAccountsInfo').returns(Promise.resolve(accsStub));
      const { result } = await matchBotHelper.setRule({
        bot_name, sponsor, voting_percent, note, enabled, expiredAt,
      });
      const matchBots = await MatchBot.find();

      expect(matchBots.length).to.be.eq(1);
      expect(result).to.be.false;
      expect(matchBots[0].sponsors[0].enabled).to.be.false;
    });

    it('should update voting percent if expiredAt was ended ', async () => {
      voting_percent = 0.2;
      await MatchBotFactory.Create({
        bot_name, sponsor, voting_percent, note, enabled: false, expiredAt: moment().toDate(),
      });
      await sinon.stub(steemHelper, 'getAccountsInfo').returns(Promise.resolve(accsStub));
      const { result } = await matchBotHelper.setRule({
        bot_name, sponsor, voting_percent: 0.01, expiredAt,
      });
      const matchBots = await MatchBot.find();

      expect(matchBots.length).to.be.eq(1);
      expect(result).to.be.true;
      expect(matchBots[0].sponsors[0].enabled).to.be.false;
      expect(matchBots[0].sponsors[0].voting_percent).to.be.eq(0.01);
    });

    it('check creation new rule with another sponsor', async () => {
      await MatchBotFactory.Create({
        bot_name, sponsor, voting_percent, note, enabled,
      });
      await sinon.stub(steemHelper, 'getAccountsInfo').returns(Promise.resolve(accsStub));
      await matchBotHelper.setRule({
        bot_name, sponsor: 'sponsor2', voting_percent, note, enabled, expiredAt,
      });
      const matchBot = await MatchBot.findOne({ bot_name });

      expect(matchBot.sponsors.length).to.be.eq(2);
    });

    it('check creation new rule with another bot name', async () => {
      await MatchBotFactory.Create({
        bot_name, sponsor, voting_percent, note, enabled,
      });
      await sinon.stub(steemHelper, 'getAccountsInfo').returns(Promise.resolve(accsStub));
      await matchBotHelper.setRule({
        bot_name: 'some_name', sponsor, voting_percent, note, enabled, expiredAt,
      });
      const matchBots = await MatchBot.find();

      expect(matchBots.length).to.be.eq(2);
    });

    it('check update exist rule and enabled false', async () => {
      voting_percent = 0.2;
      enabled = false;
      await MatchBotFactory.Create({
        bot_name, sponsor, voting_percent, note, enabled,
      });
      await sinon.stub(steemHelper, 'getAccountsInfo').returns(Promise.resolve(accsStub));
      await matchBotHelper.setRule({
        bot_name, sponsor, voting_percent, note, enabled,
      });
      const matchBots = await MatchBot.find();

      expect(matchBots.length).to.be.eq(1);
      expect(matchBots[0].sponsors[0].enabled).to.be.false;
      expect(matchBots[0].bot_name).to.be.eq(bot_name);
      expect(matchBots[0].sponsors[0].sponsor_name).to.be.eq(sponsor);
      expect(matchBots[0].sponsors[0].note).to.be.eq(note);
      expect(matchBots[0].sponsors[0].voting_percent).to.be.eq(voting_percent);
    });

    it('check minimum voting percent', async () => {
      voting_percent = 0.01;
      await sinon.stub(steemHelper, 'getAccountsInfo').returns(Promise.resolve(accsStub));
      await matchBotHelper.setRule({
        bot_name, sponsor, voting_percent, note, enabled, expiredAt,
      });
      const matchBots = await MatchBot.find();

      expect(matchBots.length).to.be.eq(1);
      expect(matchBots[0].sponsors[0].voting_percent).to.be.eq(voting_percent);
    });

    it('check maximum voting percent', async () => {
      voting_percent = 1;
      await sinon.stub(steemHelper, 'getAccountsInfo').returns(Promise.resolve(accsStub));
      await matchBotHelper.setRule({
        bot_name, sponsor, voting_percent, note, enabled, expiredAt,
      });
      const matchBots = await MatchBot.find();

      expect(matchBots.length).to.be.eq(1);
      expect(matchBots[0].sponsors[0].voting_percent).to.be.eq(voting_percent);
    });

    it('check below minimum voting percent', async () => {
      voting_percent = 0.009;
      await sinon.stub(steemHelper, 'getAccountsInfo').returns(Promise.resolve(accsStub));
      const { result } = await matchBotHelper.setRule({
        bot_name, sponsor, voting_percent, note, enabled,
      });
      const matchBots = await MatchBot.find();

      expect(matchBots.length).to.be.eq(0);
      expect(result).to.be.eq(false);
    });

    it('check greater maximum voting percent', async () => {
      voting_percent = 1.001;
      await sinon.stub(steemHelper, 'getAccountsInfo').returns(Promise.resolve(accsStub));
      const { result } = await matchBotHelper.setRule({
        bot_name, sponsor, voting_percent, note, enabled,
      });
      const matchBots = await MatchBot.find();

      expect(matchBots.length).to.be.eq(0);
      expect(result).to.be.eq(false);
    });

    it('should created rule with enabled true and has authorize to bot', async () => {
      await sinon.stub(steemHelper, 'getAccountsInfo').returns(Promise.resolve(accsStub));
      await matchBotHelper.setRule({
        bot_name, sponsor, voting_percent, note, enabled, expiredAt,
      });
      const matchBots = await MatchBot.find();

      expect(matchBots.length).to.be.eq(1);
      expect(matchBots[0].sponsors[0].enabled).to.be.true;
    });

    it('should created rule with enabled false and has authorize to bot', async () => {
      enabled = false;
      await sinon.stub(steemHelper, 'getAccountsInfo').returns(Promise.resolve(accsStub));
      await matchBotHelper.setRule({
        bot_name, sponsor, voting_percent, note, enabled, expiredAt,
      });
      const matchBots = await MatchBot.find();

      expect(matchBots.length).to.be.eq(1);
      expect(matchBots[0].sponsors[0].enabled).to.be.false;
    });

    it('should created rule with enabled false and has not authorize to bot', async () => {
      enabled = false;
      accsStub[0].posting.account_auths = [[0, 'some_acc']];
      await sinon.stub(steemHelper, 'getAccountsInfo').returns(Promise.resolve(accsStub));
      await matchBotHelper.setRule({
        bot_name, sponsor, voting_percent, note, enabled, expiredAt,
      });
      const matchBots = await MatchBot.find();

      expect(matchBots.length).to.be.eq(1);
      expect(matchBots[0].sponsors[0].enabled).to.be.false;
    });

    it('should created rule with enabled true and has not authorize to bot', async () => {
      accsStub[0].posting.account_auths = [[0, 'some_acc']];
      await sinon.stub(steemHelper, 'getAccountsInfo').returns(Promise.resolve(accsStub));
      await matchBotHelper.setRule({
        bot_name, sponsor, voting_percent, note, enabled, expiredAt,
      });
      const matchBots = await MatchBot.find();

      expect(matchBots.length).to.be.eq(1);
      expect(matchBots[0].sponsors[0].enabled).to.be.false;
    });

    it('should created rule with enabled true and without authorized posting users', async () => {
      accsStub[0].posting.account_auths = [];
      await sinon.stub(steemHelper, 'getAccountsInfo').returns(Promise.resolve(accsStub));
      await matchBotHelper.setRule({
        bot_name, sponsor, voting_percent, note, enabled, expiredAt,
      });
      const matchBots = await MatchBot.find();

      expect(matchBots.length).to.be.eq(1);
      expect(matchBots[0].sponsors[0].enabled).to.be.false;
    });

    it('should not created rule with not found sponsor or bot acc', async () => {
      accsStub[1] = undefined;
      await sinon.stub(steemHelper, 'getAccountsInfo').returns(Promise.resolve(accsStub));
      const { result } = await matchBotHelper.setRule({
        bot_name, sponsor, voting_percent, note, enabled, expiredAt,
      });
      const matchBots = await MatchBot.find();

      expect(matchBots.length).to.be.eq(0);
      expect(result).to.be.eq(false);
    });

    it('should not created rule with not found sponsor and bot acc', async () => {
      accsStub = [];
      await sinon.stub(steemHelper, 'getAccountsInfo').returns(Promise.resolve(accsStub));
      const { result } = await matchBotHelper.setRule({
        bot_name, sponsor, voting_percent, note, enabled, expiredAt,
      });
      const matchBots = await MatchBot.find();

      expect(matchBots.length).to.be.eq(0);
      expect(result).to.be.eq(false);
    });
  });
  describe('checkDisable', async () => {
    let bot1, bot2, sponsor1, sponsor2, account_auths, expiredAt;

    beforeEach(async () => {
      await dropDatabase();
      bot1 = 'bot1';
      bot2 = 'bot2';
      sponsor1 = 'sponsor1';
      sponsor2 = 'sponsor2';
      expiredAt = moment().utc().add(1, 'days').startOf('date')
        .toDate();
      account_auths = [[0, Constants.upvoteBot.userName]];

      await MatchBotFactory.Create({
        bot_name: bot1,
        sponsors: [
          { sponsor_name: 'sponsor1', enabled: true, expiredAt },
          { sponsor_name: 'sponsor2', enabled: true, expiredAt },
        ],
      });
      await MatchBotFactory.Create({
        bot_name: bot2,
        sponsors: [
          { sponsor_name: 'sponsor1', enabled: true, expiredAt },
        ],
      });

      // await MatchBotFactory.Create( { bot_name: bot1, sponsor: sponsor1, enabled: true } );
      // await MatchBotFactory.Create( { bot_name: bot1, sponsor: sponsor2, enabled: true } );
      // await MatchBotFactory.Create( { bot_name: bot2, sponsor: sponsor1, enabled: true } );
    });

    afterEach(() => {
      sinon.restore();
    });

    it('should disable match bots', async () => {
      await matchBotHelper.checkDisable({ bot_name: bot1, account_auths: [] });
      const matchBots = await MatchBot.findOne({ bot_name: bot1 });

      expect(_.map(matchBots.sponsors, 'enabled')).to.be.eql([false, false]);
    });

    it('check another bots with disable', async () => {
      await matchBotHelper.checkDisable({ bot_name: bot1, account_auths: [] });
      const matchBots = await MatchBot.findOne({ bot_name: bot2 });

      expect(_.map(matchBots.sponsors, 'enabled')).to.be.eql([true]);
    });

    it('should not disable match bots with auth bot', async () => {
      await matchBotHelper.checkDisable({ bot_name: bot1, account_auths });
      const matchBots = await MatchBot.findOne({ bot_name: bot1 });

      expect(_.map(matchBots.sponsors, 'enabled')).to.be.eql([true, true]);
    });

    it('should not disable not exist match bots', async () => {
      await matchBotHelper.checkDisable({ bot_name: 'aaaa', account_auths: [] });
      const matchBots = await MatchBot.find();

      expect(matchBots[0].sponsors[0].enabled).to.be.eq(true);
      expect(matchBots[0].sponsors[1].enabled).to.be.eq(true);
      expect(matchBots[1].sponsors[0].enabled).to.be.eq(true);
    });
  });

  describe('on checkForPayed', async () => {
    describe('marker Add', async () => {
      describe('payed history', async () => {
        let history, amount;
        beforeEach(async () => {
          await dropDatabase();
          history = await PaymentHistoryFactory.Create({ payed: true });
          amount = _.random(1, 5);
        });
        describe('with transfer', async () => {
          it('should return true if remaining > amount', async () => {
            await PaymentHistoryFactory.Create({
              payed: false, type: 'transfer', remaining: amount + 1, userName: history.userName, sponsor: history.sponsor,
            });
            const result = await matchBotHelper.checkForPayed({ history, amount, marker: 'add' });
            expect(result).to.be.true;
          });
          it('should return false if remaining < amount', async () => {
            await PaymentHistoryFactory.Create({
              payed: false, type: 'transfer', remaining: amount - 1, userName: history.userName, sponsor: history.sponsor,
            });
            const result = await matchBotHelper.checkForPayed({ history, amount, marker: 'add' });
            expect(result).to.be.false;
          });
          it('should update transfer with correct amount', async () => {
            const transfer = await PaymentHistoryFactory.Create({
              payed: false, type: 'transfer', remaining: amount + 1, userName: history.userName, sponsor: history.sponsor,
            });
            await matchBotHelper.checkForPayed({ history, amount, marker: 'add' });
            const result = await PaymentHistory.findOne({ _id: transfer._id });
            expect(!result.payed && result.details.remaining === 1).to.be.true;
          });
          it('should update transfer to status payed', async () => {
            const transfer = await PaymentHistoryFactory.Create({
              payed: false, type: 'transfer', remaining: amount, userName: history.userName, sponsor: history.sponsor,
            });
            await matchBotHelper.checkForPayed({ history, amount, marker: 'add' });
            const result = await PaymentHistory.findOne({ _id: transfer._id });
            expect(result.payed && result.details.remaining === 0).to.be.true;
          });
          it('should not update transfer if remaining < amount', async () => {
            const transfer = await PaymentHistoryFactory.Create({
              payed: false, type: 'transfer', remaining: amount - 0.5, userName: history.userName, sponsor: history.sponsor,
            });
            await matchBotHelper.checkForPayed({ history, amount, marker: 'add' });
            const result = await PaymentHistory.findOne({ _id: transfer._id }).lean();
            expect(!result.payed && result.details.remaining === transfer.details.remaining + history.amount).to.be.true;
          });
        });
        describe('without transfer', async () => {
          it('should return false if transfer not exist', async () => {
            const result = await matchBotHelper.checkForPayed({ history, amount, marker: 'add' });
            expect(result).to.be.false;
          });
        });
      });

      describe('not payed history', async () => {
        let history, amount;
        beforeEach(async () => {
          await dropDatabase();
          history = await PaymentHistoryFactory.Create({ payed: false });
          amount = _.random(1, 5);
        });
        it('should return false if history not payed', async () => {
          const result = await matchBotHelper.checkForPayed({ history, amount, marker: 'add' });
          expect(result).to.be.false;
        });
      });
    });

    describe('marker Subtract', async () => {
      describe('payed history', async () => {
        describe('transfer exists', async () => {
          let history, amount, transfer, result;
          beforeEach(async () => {
            await dropDatabase();
            history = await PaymentHistoryFactory.Create({ payed: true });
            transfer = await PaymentHistoryFactory.Create({
              payed: false, type: 'transfer', remaining: amount, userName: history.userName, sponsor: history.sponsor,
            });
            amount = _.random(1, 5);
            result = await matchBotHelper.checkForPayed({ history, amount, marker: 'subtract' });
          });
          it('should return true with subtract', async () => {
            expect(result).to.be.true;
          });
        });

        describe('transfer not exist', async () => {

        });
      });

      describe('not payed history', async () => {

      });
    });
  });
});
