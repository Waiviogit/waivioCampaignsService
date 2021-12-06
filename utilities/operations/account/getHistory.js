const { engineAccountHistoryModel } = require('models');
const _ = require('lodash');
const hiveEngineRequests = require('../../requests/hiveEngineRequests');

module.exports = async (params) => {
  const res = await hiveEngineRequests(params);

  if (res instanceof Error) return { error: res };

  const { result, error } = await engineAccountHistoryModel.find({
    account: params.account,
    $or: [{ symbol: params.symbol }, { symbolOut: params.symbol }, { symbolIn: params.symbol }],
  }, params.skip, params.limit);

  if (error) return { error };

  const history = _.concat(res.data, result).sort((x, y) => y.timestamp - x.timestamp);

  return { history };
};
