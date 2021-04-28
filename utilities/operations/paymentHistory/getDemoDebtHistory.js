const { GUEST_WALLET_OPERATIONS } = require('constants/constants');
const guestRequests = require('utilities/requests/guestRequests');
const walletHelper = require('utilities/helpers/walletHelper');
const { paymentHistoryModel } = require('models');
const moment = require('moment');
const _ = require('lodash');

module.exports = async ({
  userName, skip, limit, tableView, endDate, startDate,
}, accessToken) => {
  let payable = 0;
  const pipeline = [
    { $match: { userName, type: { $in: GUEST_WALLET_OPERATIONS } } },
    { $sort: { createdAt: 1 } },
  ];

  if (tableView) {
    pipeline[0].$match.$and = [
      { createdAt: { $gte: startDate } },
      { createdAt: { $lte: endDate } }];
  }

  const { result: histories, error } = await paymentHistoryModel.aggregate(pipeline);
  if (error) return { error };

  _.map(histories, (history) => {
    if (_.get(history, 'details.transactionId')) return;
    switch (history.type) {
      case 'user_to_guest_transfer':
      case 'demo_post':
      case 'demo_debt':
        history.balance = _.round(payable + history.amount, 3);
        payable = _.round(history.balance, 3);
        break;
      case 'demo_user_transfer':
        history.balance = _.round(payable - history.amount, 3);
        payable = _.round(history.balance, 3);
        break;
    }
  });
  _.reverse(histories);
  if (!accessToken || !await guestRequests.validateUser(accessToken, userName)) {
    _.map(histories, (history) => history.withdraw = null);
  }
  const result = await addHivePrice(histories);
  return {
    histories: result.slice(skip, limit + skip),
    payable: _.round(payable, 3),
    hasMore: result.slice(skip, limit + skip + 1).length > limit,
  };
};

const addHivePrice = async (histories = []) => {
  if (_.isEmpty(histories)) return histories;
  const hivePriceArr = await walletHelper.getHiveCurrencyHistory(histories, 'createdAt');
  return _.map(histories, (history) => {
    const price = _.find(hivePriceArr, (el) => moment(el.createdAt).isSame(moment(history.createdAt), 'day'));
    return {
      ...history,
      hiveUSD: parseFloat(_.get(price, 'hive.usd', '0')),
      hbdUSD: parseFloat(_.get(price, 'hive_dollar.usd', '0')),
    };
  });
};
