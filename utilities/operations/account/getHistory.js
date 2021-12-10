const { engineAccountHistoryModel } = require('models');
const _ = require('lodash');
const hiveEngineRequests = require('../../requests/hiveEngineRequests');

module.exports = async (params) => {
  if (params.timestamp) {
    let asd = [];
    let skp = 0;
    while (asd.length < params.limit) {
      const res = await hiveEngineRequests(params, skp, 1000);
      if (res instanceof Error) return { error: res };
      asd = _.filter(res.data, (el) => el.timestamp <= params.timestamp);
      if (res.data < params.limit) break;
      skp += 1000;
    }

    const { result, error } = await engineAccountHistoryModel.find({
      account: params.account,
      timestamp: { $lte: params.timestamp },
      $or: [{ symbol: params.symbol }, { symbolOut: params.symbol }, { symbolIn: params.symbol }],
    });

    if (error) return { error };

    const resArray = _.concat(asd, result).sort((x, y) => y.timestamp - x.timestamp);


    const skipp = resArray.indexOf(_.find(resArray, (obj) => obj.timestamp === params.timestamp)) + 1;

    const history = resArray.slice(skipp, skipp + params.limit);
    return { history };
  } else {
    const res = await hiveEngineRequests(params, 0, params.limit);
    if (res instanceof Error) return { error: res };

    const { result, error } = await engineAccountHistoryModel.find({
      account: params.account,
      $or: [{ symbol: params.symbol }, { symbolOut: params.symbol }, { symbolIn: params.symbol }],
    }, 0, params.limit);

    if (error) return { error };

    const resArray = _.concat(res.data, result).sort((x, y) => y.timestamp - x.timestamp);

    const history = _.take(resArray, params.limit);
    return { history };
  }
};
