const { HISTORY_OPERATION_TYPES, HISTORY_API_OPS } = require('constants/hiveEngine');
const { engineAccountHistoryModel } = require('models');
const _ = require('lodash');
const moment = require('moment');
const { accountHistory } = require('../../hiveEngine/engineOperations');
const { divide } = require('../../helpers/calcHelper');
const {
  TOKEN_WAIV,
  MARKET_OPERATION,
  MARKET_CONTRACT,
} = require('../../../constants/hiveEngine');

const getAccountHistory = async (params) => {
  const { filteredApiData, errorApiResponse } = await getFilteredApiData({ params });
  if (errorApiResponse) return { error: errorApiResponse };

  const { result: dbResponse, error } = await engineAccountHistoryModel.find({
    condition: constructDbQuery(params),
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

const constructApiQuery = ({
  params, limit, count, timestampEnd, skip,
}) => {
  // как сделать так чтоб не затирался
  console.log('count', count);
  console.log(moment().unix());
  console.log('timestampEnd', timestampEnd);
  console.log('skip', skip);

  return {
    // тут менять таймстамп
    ...(params.timestampEnd && { timestampEnd: params.timestampEnd, timestampStart: 1 }),
    ...(params.symbol && { symbol: params.symbol }),
    account: params.account,
    ops: !params.showRewards ? HISTORY_API_OPS.toString()
      : [...HISTORY_API_OPS, ...Object.values(HISTORY_OPERATION_TYPES)].toString(),
    limit,
    ...(count && { offset: skip }),
    ...(timestampEnd && { timestampStart: timestampEnd, timestampEnd: moment().unix() }),
  };
};

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

const getFilteredApiData = async ({
  params, count = 0, filteredApiData = [], timestampEnd = 0, skip = 0,
}) => {
  let limit = params.limit + 100;
  if (params.excludeSymbols) limit = 1000;
  // timestamp менять как-то!
  const apiResponse = await accountHistory(constructApiQuery({
    params, limit, count, timestampEnd, skip,
  }));
  // сделать какую-то рекурсию?
  if (apiResponse instanceof Error) return { errorApiResponse: apiResponse };

  filteredApiData.push(..._.filter(
    apiResponse.data,
    (el) => !_.includes(params.excludeSymbols, el.symbol),
  ));

  console.log('limit', limit);
  console.log('filteredApiData.length', filteredApiData.length);
  const timestampEndForQuery = filteredApiData[filteredApiData.length - 1].timestamp + 1;
  if (limit >= 1000 && filteredApiData.length < limit && timestampEnd !== timestampEndForQuery) {
    count++;
    await getFilteredApiData({
      params,
      count,
      filteredApiData,
      timestampEnd: timestampEndForQuery,
      skip: filteredApiData.length,
    });
  }
  console.log('after if');
  return { filteredApiData };
};

module.exports = {
  getAccountHistory,
};
