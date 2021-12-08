const { engineAccountHistoryModel } = require('models');
const _ = require('lodash');
const hiveEngineRequests = require('../../requests/hiveEngineRequests');

module.exports = async (params) => {
  const { result, error } = await engineAccountHistoryModel.find({
    account: params.account,
    $or: [{ symbol: params.symbol }, { symbolOut: params.symbol }, { symbolIn: params.symbol }],
  });

  if (error) return { error };

  const reqData = {
    symbol: params.symbol,
    account: params.account,
    offset: 0,
    limit: 100 + result.length,
  };
  const res = await hiveEngineRequests(reqData);

  if (res instanceof Error) return { error: res };

  const resArray = _.concat(res.data, result).sort((x, y) => y.timestamp - x.timestamp);

  const history = resArray.slice(params.skip, params.skip + params.limit);
  return { history };
};
