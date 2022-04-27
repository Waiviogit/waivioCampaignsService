const { HISTORY_OPERATION_TYPES, HISTORY_API_OPS } = require('constants/hiveEngine');
const { engineAccountHistoryModel } = require('models');
const _ = require('lodash');
const moment = require('moment');
const { accountHistory } = require('../../hiveEngine/engineOperations');
const {
  divide,
  multiply,
} = require('../../helpers/calcHelper');
const {
  TOKEN_WAIV,
  MARKET_OPERATION,
  MARKET_CONTRACT,
} = require('../../../constants/hiveEngine');

const getAccountHistory = async (params) => {
  const { apiResponseData, errorApiResponse } = await getApiData({ params });
  if (errorApiResponse) return { error: errorApiResponse };

  const { result: dbResponse, error } = await engineAccountHistoryModel.find({
    condition: constructDbQuery(params),
    limit: params.limit + 100,
    sort: { timestamp: -1 },
  });
  if (error) return { error };

  const sortedHistory = _.orderBy(
    [...apiResponseData, ...dbResponse],
    ['timestamp', '_id'], ['desc', 'desc'],
  );

  const updateSkip = sortedHistory
    .indexOf(_.find(sortedHistory, (obj) => obj._id.toString() === params.lastId)) + 1;
  const paginatedHistory = sortedHistory.slice(updateSkip, updateSkip + params.limit);

  const history = _.map(paginatedHistory, (item) => ({
    ...item,
    ...((item.operation === MARKET_OPERATION.PLACE_ORDER && item.orderType === MARKET_CONTRACT.BUY)
      && { quantity: divide(item.quantityLocked, item.price, TOKEN_WAIV.FRACTION_PRECISION) }),
    ...((item.operation === MARKET_OPERATION.PLACE_ORDER && item.orderType === MARKET_CONTRACT.SELL)
    && { quantity: multiply(item.quantityLocked, item.price, TOKEN_WAIV.FRACTION_PRECISION) }),
    ...((item.operation === MARKET_OPERATION.BUY || MARKET_OPERATION.SELL)
      && { price: divide(item.quantityHive, item.quantityTokens, TOKEN_WAIV.FRACTION_PRECISION) }),
  }));

  return { history };
};

const constructApiQuery = ({
  params, limit, timestampEnd,
}) => ({
  ...(params.timestampEnd && { timestampEnd: params.timestampEnd, timestampStart: 1 }),
  ...(params.symbol && { symbol: params.symbol }),
  account: params.account,
  ops: !params.showRewards ? HISTORY_API_OPS.toString()
    : [...HISTORY_API_OPS, ...Object.values(HISTORY_OPERATION_TYPES)].toString(),
  limit,
  ...(timestampEnd && { timestampStart: timestampEnd, timestampEnd: moment().unix() }),
});

const constructDbQuery = (params) => {
  let condition = _.get(params, 'symbol');
  let operator = '$or';
  if (params.excludeSymbols) {
    condition = { $nin: params.excludeSymbols };
    operator = '$and';
  }

  return {
    account: params.account,
    ...(params.timestampEnd && { timestamp: { $lte: params.timestampEnd } }),
    [operator]: [
      { symbol: condition },
      { $or: [{ symbolOut: condition }, { symbolIn: condition }] },
    ],
    operation: {
      $nin:
            [
              HISTORY_OPERATION_TYPES.BENEFICIARY_REWARD,
              HISTORY_OPERATION_TYPES.CURATION_REWARDS,
              HISTORY_OPERATION_TYPES.AUTHOR_REWARDS,
            ],
    },
  };
};

const getApiData = async ({
  params, apiResponseData = [], timestampEnd = 0,
}) => {
  const limit = params.excludeSymbols ? TOKEN_WAIV.MAX_LIMIT : params.limit + 100;

  const apiResponse = await accountHistory(constructApiQuery({
    params, limit, timestampEnd,
  }));
  if (apiResponse instanceof Error) return { errorApiResponse: apiResponse };

  if (params.excludeSymbols) {
    apiResponseData.push(..._.filter(apiResponse.data,
      (el) => !_.includes(params.excludeSymbols, el.symbol)));
  } else apiResponseData.push(...apiResponse.data);

  if (apiResponse.data.length < limit || apiResponseData.length >= limit) {
    return { apiResponseData };
  }

  const timestampEndForQuery = apiResponseData[apiResponseData.length - 1].timestamp;
  await getApiData({
    params,
    apiResponseData,
    timestampEnd: timestampEndForQuery,
  });
};

module.exports = {
  getAccountHistory,
};
