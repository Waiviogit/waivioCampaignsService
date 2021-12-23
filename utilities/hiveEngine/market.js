const engineQuery = require('utilities/hiveEngine/engineQuery');

exports.getMarketMetrics = async ({ query }) => engineQuery({
  params: {
    contract: 'market',
    table: 'metrics',
    query,
  },
});
