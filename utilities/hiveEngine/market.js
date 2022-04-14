const { engineProxy } = require('utilities/hiveEngine/engineQuery');

exports.getMarketMetrics = async ({ query }) => engineProxy({
  params: {
    contract: 'market',
    table: 'metrics',
    query,
  },
});
