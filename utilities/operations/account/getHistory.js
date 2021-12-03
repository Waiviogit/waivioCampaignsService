const { engineAccountHistoryModel } = require('models');
const _ = require('lodash');
const axios = require('axios');

module.exports = async (params) => {
  const res = await axios.get('https://accounts.hive-engine.com/accountHistory', { params });
  const { result, error } = await engineAccountHistoryModel.find({
    account: params.account,
    $or: [{ symbol: params.symbol }, { symbolOut: params.symbol }, { symbolIn: params.symbol }],
  }, params.skip, params.limit);

  if (error) return { error };

  const history = _.concat(res.data, result).sort((x, y) => y.timestamp - x.timestamp);

  return { history };
};
