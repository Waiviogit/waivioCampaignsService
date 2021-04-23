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
      mock = [
        _.random(0, 10),
        { timestamp: moment.utc(date).format('yyyy-MM-DDTHH:mm:ss') },
      ];
      currency = await CurrenciesStatisticsFactory.Create({ createdAt: moment.utc(date).format(), type: 'dailyData' });
      result = await walletHelper.getHiveCurrencyHistory([mock]);
    });

    afterEach(() => {
      sinon.restore();
    });

    it('should find exact record on date', async () => {
      result = await walletHelper.getHiveCurrencyHistory([mock]);
      expect(result[0]).to.be.deep.eq(currency);
    });

    it('should call currencyRequest if current date', async () => {
      mock[1].timestamp = moment.utc().format('yyyy-MM-DDTHH:mm:ss');
      result = await walletHelper.getHiveCurrencyHistory([mock]);

      expect(currencyRequest.getHiveCurrency.calledOnce).to.be.true;
    });

    it('should call currencyRequest with proper params', async () => {
      mock[1].timestamp = moment.utc().format('yyyy-MM-DDTHH:mm:ss');
      result = await walletHelper.getHiveCurrencyHistory([mock]);
      const [calledArgs] = currencyRequest.getHiveCurrency.args;

      expect(calledArgs[0]).to.be.deep.eq(['hive', 'hive_dollar']);
    });
  });
});
