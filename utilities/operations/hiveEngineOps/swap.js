const marketPools = require('utilities/hiveEngine/marketPools');
const _ = require('lodash');

exports.getSwapParams = async () => {
  const pools = await marketPools.getMarketPools({ query: {} });
  if (_.has(pools, 'error')) return { error: pools.error };

  const symbols = new Set();
  for (const pool of pools) {
    const [base, quote] = pool.tokenPair.split(':');
    symbols.add(base);
    symbols.add(quote);
  }

  const result = _.reduce([...symbols], (acc, ell) => {
    acc[ell] = _.reduce(pools, (accum, el2) => {
      const [symbolA, symbolB] = el2.tokenPair.split(':');
      const symbol = ell === symbolA ? symbolB : symbolA;
      if (_.includes(el2.tokenPair, ell)) accum.push({ ...el2, symbol });
      return accum;
    }, []);
    return acc;
  }, {});

  return { result };
};
