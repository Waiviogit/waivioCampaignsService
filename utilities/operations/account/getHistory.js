const { engineAccountHistoryModel } = require('models');
const _ = require('lodash');
const hiveEngineRequests = require('./hiveEngineRequests');

module.exports = async (params) => {
  let condition = params.symbol;
  let operator = '$or';

  if (params.excludeSymbols) {
    condition = { $nin: params.excludeSymbols };
    operator = '$and';
  }

  if (params.timestampEnd) {
    const data = {
      symbol: params.symbol,
      account: params.account,
      offset: 0,
      limit: params.limit,
      timestampEnd: params.timestampEnd,
      timestampStart: 1,
    };

    const res = await hiveEngineRequests(data);
    const sortedRes = _.filter(res.data, (el) => !_.includes(params.excludeSymbols, el.symbol));

    const { result, error } = await engineAccountHistoryModel.find({
      condition: {
        account: params.account,
        timestamp: { $lte: params.timestampEnd },
        [operator]: [{ symbol: condition }, { symbolOut: condition }, { symbolIn: condition }],
      },
    });

    if (error) return { error };

    const resArray = _.concat(sortedRes, result).sort((x, y) => y.timestamp - x.timestamp);

    const updateSkip = resArray.indexOf(_.find(resArray, (obj) => obj.timestamp === params.timestampEnd)) + 1;

    const history = resArray.slice(updateSkip, updateSkip + params.limit);

    return { history };
  } else {

    const data = {
      symbol: params.symbol,
      account: params.account,
      offset: 0,
      limit: params.limit,
    };

    const res = await hiveEngineRequests(data);
    if (res instanceof Error) return { error: res };

    const sortedRes = _.filter(res.data, (el) => !_.includes(params.excludeSymbols, el.symbol));
    const {
      result,
      error
    } = await engineAccountHistoryModel.find({
      condition: {
        account: params.account,
        [operator]: [{ symbol: condition }, { symbolOut: condition }, { symbolIn: condition }],
      },
      skip: 0,
      limit: params.limit,
    });
    if (error) return { error };

    const resArray = _.concat(sortedRes, result).sort((x, y) => y.timestamp - x.timestamp);
    const history = _.take(resArray, params.limit);

    return { history };
  }
};
