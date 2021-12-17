const { engineAccountHistoryModel } = require('models');
const _ = require('lodash');
const { hiveEngineRequest } = require('../../hiveEngine/engineOperations');

const getHistoryData = async (params) => {
  let condition = _.get(params, 'symbol');
  let operator = '$or';
  let { limit } = params;

  if (params.excludeSymbols) {
    condition = { $nin: params.excludeSymbols };
    operator = '$and';
    limit = 1000;
  }

  const data = {
    ...(params.timestampEnd && { timestampEnd: params.timestampEnd, timestampStart: 1 }),
    ...(params.symbol && { symbol: params.symbol }),
    account: params.account,
    limit,
  };

  const query = {
    account: params.account,
    ...(params.timestampEnd && { timestamp: { $lte: params.timestampEnd } }),
    [operator]: [{ symbol: condition }, { symbolOut: condition }, { symbolIn: condition }],
  };
  return { data, query };
};

const getAccountHistory = async (params) => {
  const { data, query } = await getHistoryData(params);

  const res = await hiveEngineRequest(data);
  if (res instanceof Error) return { error: res };

  const sortedRes = _.filter(res.data, (el) => !_.includes(params.excludeSymbols, el.symbol));
  const { result, error } = await engineAccountHistoryModel.find({
    condition: query,
    limit: params.limit,
    sort: { timestamp: -1 },
  });
  if (error) return { error };

  const resArray = _.concat(sortedRes, result).sort((x, y) => y.timestamp - x.timestamp);

  const updateSkip = resArray.indexOf(_.find(resArray, (obj) => obj.timestamp === params.timestampEnd)) + 1;
  const history = resArray.slice(updateSkip, updateSkip + params.limit);

  return { history };
};

module.exports = {
  getAccountHistory,
};
