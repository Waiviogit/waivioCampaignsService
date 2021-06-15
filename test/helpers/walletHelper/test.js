const {
  dropDatabase, faker, walletHelper, _, moment, expect, sinon, currencyRequest,
} = require('test/testHelper');
const { CurrenciesStatisticsFactory } = require('test/factories');

describe('On walletHelper', async () => {
  describe('On getHiveCurrencyHistory', async () => {
    let currency, result, mock;
    const date = faker.date.past();
    beforeEach(async () => {
      await dropDatabase();
      sinon.spy(currencyRequest, 'getHiveCurrency');
      currency = await CurrenciesStatisticsFactory.Create({ createdAt: moment.utc(date).format(), type: 'dailyData' });
    });

    afterEach(() => {
      sinon.restore();
    });

    it('should find exact record on date', async () => {
      mock = [{ timestamp: moment(date).unix() }];
      result = await walletHelper.getHiveCurrencyHistory(mock);
      expect(result[0]).to.be.deep.eq(currency);
    });

    it('should call currencyRequest if current date', async () => {
      mock = [{ timestamp: moment().unix() }];
      result = await walletHelper.getHiveCurrencyHistory(mock);
      expect(currencyRequest.getHiveCurrency.calledOnce).to.be.true;
    });
  });
});
