const currencyRequest = require('utilities/requests/currencyRequest');
const marketPools = require('utilities/hiveEngine/marketPools');
const market = require('utilities/hiveEngine/market');
const BigNumber = require('bignumber.js');
const _ = require('lodash');

exports.getSwapParams = async () => {
  const requestsData = await Promise.all([
    marketPools.getMarketPools({ query: {} }),
    market.getMarketMetrics({ query: {} }),
    currencyRequest.getHiveCurrency(),
  ]);
  for (const request of requestsData) {
    if (_.has(request, 'error')) return { error: request.error };
  }
  const [pools, metrics, currency] = requestsData;

  const filteredPools = filterPoolsByUsdValue({
    pools, metrics, filterValue: 1000, hivePrice: currency.usdCurrency,
  });

  const symbols = new Set();
  for (const pool of filteredPools) {
    const [base, quote] = pool.tokenPair.split(':');
    symbols.add(base);
    symbols.add(quote);
  }

  const result = _.reduce([...symbols], (acc, ell) => {
    acc[ell] = _.reduce(filteredPools, (accum, el2) => {
      const [symbolA, symbolB] = el2.tokenPair.split(':');
      const symbol = ell === symbolA ? symbolB : symbolA;
      if (_.includes(el2.tokenPair, ell)) accum.push({ ...el2, symbol });
      return accum;
    }, []);
    return acc;
  }, {});

  return { result };
};

const filterPoolsByUsdValue = ({
  pools, metrics, hivePrice, filterValue,
}) => _.reduce(pools, (acc, pool) => {
  const [baseSymbol, quoteSymbol] = pool.tokenPair.split(':');
  const { baseQuantity, quoteQuantity } = pool;

  const { usdVolume } = getPoolVolume({
    baseSymbolPrice: getPriceInHive({ symbol: baseSymbol, metrics }),
    quoteSymbolPrice: getPriceInHive({ symbol: quoteSymbol, metrics }),
    baseQuantity,
    quoteQuantity,
    hivePrice,
  });
  if (usdVolume.gte(filterValue)) acc.push(pool);
  return acc;
}, []);

const getPoolVolume = ({
  quoteSymbolPrice,
  baseSymbolPrice,
  baseQuantity,
  quoteQuantity,
  hivePrice,
}) => {
  const hiveVolume = (BigNumber(baseSymbolPrice).times(baseQuantity))
    .plus(BigNumber(quoteSymbolPrice).times(quoteQuantity));
  const usdVolume = hiveVolume.times(hivePrice);

  return { hiveVolume, usdVolume };
};

const getPriceInHive = ({ symbol, metrics }) => (symbol === 'SWAP.HIVE'
  ? '1'
  : _.get(
    _.find(metrics, (el) => el.symbol === symbol),
    'lastPrice',
  ));
