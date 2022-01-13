const { engineAccountHistoryModel } = require('models');
const _ = require('lodash');
const { accountHistory } = require('../../hiveEngine/engineOperations');

const getHistoryData = async (params) => {
  let condition = _.get(params, 'symbol');
  let limit = params.limit + 1;
  let operator = '$or';

  if (params.excludeSymbols) {
    condition = { $nin: params.excludeSymbols };
    limit = 1000;
    operator = '$and';
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
    [operator]: [
      { symbol: condition },
      { $or: [{ symbolOut: condition }, { symbolIn: condition }] },
    ],
  };
  return { data, query };
};

const getAccountHistory = async (params) => {
  const { data, query } = await getHistoryData(params);

  const res = await accountHistory(data);
  if (res instanceof Error) return { error: res };

  const sortedRes = _.filter(res.data, (el) => !_.includes(params.excludeSymbols, el.symbol));
  const { result, error } = await engineAccountHistoryModel.find({
    condition: query,
    limit: params.limit + 1,
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