const {
  chai, chaiHttp, app, dropDatabase, moment,
} = require('test/testHelper');
const { MatchBotFactory } = require('test/factories');

chai.use(chaiHttp);
chai.should();
const { expect } = chai;


describe('MatchBot controller', async () => {
  describe('get match bots', async () => {
    let botName1, botName2, expiredAt;

    beforeEach(async () => {
      await dropDatabase();
      botName1 = 'bot1';
      botName2 = 'bot2';
      expiredAt = moment().utc().add(1, 'days').startOf('date')
        .toDate();
      await MatchBotFactory.Create({
        bot_name: botName1,
        sponsors: [
          { sponsor_name: 'sponsor1', enabled: true, expiredAt },
          { sponsor_name: 'sponsor2', enabled: true, expiredAt },
          { sponsor_name: 'sponsor3', enabled: false, expiredAt },
          { sponsor_name: 'sponsor4', enabled: false, expiredAt },
        ],
      });
      await MatchBotFactory.Create({
        bot_name: botName2,
        sponsors: [
          { sponsor_name: 'sponsor1', enabled: true, expiredAt },
        ],
      });
    });
    it('get bot1 accounts', async () => {
      const res = await chai.request(app).get(`/campaigns-api/match_bots?bot_name=${botName1}`);

      res.should.have.status(200);
      expect(res.body.results.length).to.be.eq(4);
    });

    it('check voting power field', async () => {
      const res = await chai.request(app).get(`/campaigns-api/match_bots?bot_name=${botName1}`);

      res.should.have.status(200);
      expect(res.body.votingPower).to.be.eq(8000);
    });

    it('get bot accounts with limit', async () => {
      const res = await chai.request(app).get(`/campaigns-api/match_bots?bot_name=${botName1}&limit=2`);

      res.should.have.status(200);
      expect(res.body.results.length).to.be.eq(2);
    });

    it('get bot accounts with skip', async () => {
      const res = await chai.request(app).get(`/campaigns-api/match_bots?bot_name=${botName1}&skip=3`);

      res.should.have.status(200);
      expect(res.body.results.length).to.be.eq(1);
    });

    it('get bot accounts with skip and limit', async () => {
      const res = await chai.request(app).get(`/campaigns-api/match_bots?bot_name=${botName1}&skip=2&limit=2`);

      res.should.have.status(200);
      expect(res.body.results.length).to.be.eq(2);
    });

    it('get bot accounts with invalid name', async () => {
      const res = await chai.request(app).get('/campaigns-api/match_bots?bot_name=a');

      res.should.have.status(200);
      expect(res.body.results.length).to.be.eq(0);
    });

    it('get bot accounts without name', async () => {
      const res = await chai.request(app).get('/campaigns-api/match_bots');

      res.should.have.status(200);
      expect(res.body.results.length).to.be.eq(0);
    });

    it('get bot2 accounts', async () => {
      const res = await chai.request(app).get(`/campaigns-api/match_bots?bot_name=${botName2}`);

      res.should.have.status(200);
      expect(res.body.results.length).to.be.eq(1);
    });
  });
});
