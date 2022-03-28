const { HISTORY_OPERATION_TYPES, HISTORY_API_OPS } = require('constants/hiveEngine');
const { engineAccountHistoryModel } = require('models');
const _ = require('lodash');
const { accountHistory } = require('../../hiveEngine/engineOperations');
const { divide } = require('../../helpers/calcHelper');
const {
  TOKEN_WAIV,
  MARKET_OPERATION,
  MARKET_CONTRACT,
} = require('../../../constants/hiveEngine');

const getHistoryData = async (params) => {
  let condition = _.get(params, 'symbol');
  let limit = params.limit + 100;
  let operator = '$or';
  let excludeOperation = { $nin: [] };
  if (params.excludeSymbols) {
    condition = { $nin: params.excludeSymbols };
    limit = 1000;
    operator = '$and';
  }
  if (!params.showRewards) {
    excludeOperation = {
      $nin:
        [
          HISTORY_OPERATION_TYPES.BENEFICIARY_REWARD,
          HISTORY_OPERATION_TYPES.CURATION_REWARDS,
          HISTORY_OPERATION_TYPES.AUTHOR_REWARDS,
        ],
    };
  }

  const data = {
    ...(params.timestampEnd && { timestampEnd: params.timestampEnd, timestampStart: 1 }),
    ...(params.symbol && { symbol: params.symbol }),
    account: params.account,
    ops: HISTORY_API_OPS.toString(),
    limit,
  };

  const query = {
    account: params.account,
    ...(params.timestampEnd && { timestamp: { $lte: params.timestampEnd } }),
    [operator]: [
      { symbol: condition },
      { $or: [{ symbolOut: condition }, { symbolIn: condition }] },
    ],
    operation: excludeOperation,
  };
  return { data, query };
};

const getAccountHistory = async (params) => {
  const { data, query } = await getHistoryData(params);

  const apiResponse = await accountHistory(data);
  if (apiResponse instanceof Error) return { error: apiResponse };

  let filteredApiData = _.filter(
    apiResponse.data,
    (el) => !_.includes(params.excludeSymbols, el.symbol),
  );

  if (!params.showRewards) {
    filteredApiData = _.filter(filteredApiData,
      (el) => !_.includes(HISTORY_OPERATION_TYPES, el.operation));
  }

  const { result: dbResponse, error } = await engineAccountHistoryModel.find({
    condition: query,
    limit: params.limit + 100,
    sort: { timestamp: -1 },
  });
  if (error) return { error };

  const sortedHistory = _.orderBy(
    [...filteredApiData, ...dbResponse],
    ['timestamp', '_id'], ['desc', 'desc'],
  );

  const updateSkip = sortedHistory
    .indexOf(_.find(sortedHistory, (obj) => obj._id.toString() === params.lastId)) + 1;
  const paginatedHistory = sortedHistory.slice(updateSkip, updateSkip + params.limit);

  const history = _.map(paginatedHistory, (item) => ({
    ...item,
    ...((item.operation === MARKET_OPERATION.PLACE_ORDER && item.orderType === MARKET_CONTRACT.BUY)
      && { quantity: divide(item.quantityLocked, item.price, TOKEN_WAIV.FRACTION_PRECISION) }),
  }));

  return { history };
};

module.exports = {
  getAccountHistory,
};
