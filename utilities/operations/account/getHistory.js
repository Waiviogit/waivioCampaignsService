const { engineAccountHistoryModel } = require('models');
const _ = require('lodash');
const hiveEngineRequests = require('../../hiveEngine/hiveEngineRequests');

const getHistoryData = async (params) => {
  if (!params.symbol && !params.excludeSymbols) return { dataError: new Error("symbol or excludeSymbol doesn't exist") };
  let condition = _.get(params, 'symbol');
  let operator = '$or';
  let { limit } = params;

  if (params.excludeSymbols) {
    condition = { $nin: params.excludeSymbols };
    operator = '$and';
    limit = 1000;
  }
  const data = {
    symbol: params.symbol,
    account: params.account,
    limit,
  };
  if (!params.symbol) delete data.symbol;

  if (params.timestampEnd) {
    data.timestampEnd = params.timestampEnd;
    data.timestampStart = 1;

    const query = {
      account: params.account,
      timestamp: { $lte: params.timestampEnd },
      [operator]: [{ symbol: condition }, { symbolOut: condition }, { symbolIn: condition }],
    };

    return { data, query };
  }

  const query = {
    account: params.account,
    [operator]: [{ symbol: condition }, { symbolOut: condition }, { symbolIn: condition }],
  };
  return { data, query };
};

const getAccountHistory = async (params) => {
  const { data, query, dataError } = await getHistoryData(params);
  if (dataError) return { error: dataError };

  const res = await hiveEngineRequests(data);
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
