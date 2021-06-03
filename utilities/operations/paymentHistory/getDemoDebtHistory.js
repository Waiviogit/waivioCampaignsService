const { GUEST_WALLET_OPERATIONS } = require('constants/constants');
const guestRequests = require('utilities/requests/guestRequests');
const walletHelper = require('utilities/helpers/walletHelper');
const { paymentHistoryModel } = require('models');
const _ = require('lodash');

module.exports = async ({
  userName, skip, limit, tableView, endDate, startDate, filterAccounts,
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
  if (tableView && !_.isEmpty(filterAccounts)) {
    pipeline[0].$match.sponsor = { $nin: filterAccounts };
  }

  const { result: histories, error } = await paymentHistoryModel.aggregate(pipeline);
  if (error) return { error };

  _.map(histories, (history) => {
    if (tableView) {
      history.withdrawDeposit = walletHelper.withdrawDeposit(history.type);
    }

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

  return {
    histories: histories.slice(skip, limit + skip),
    payable: _.round(payable, 3),
    hasMore: histories.slice(skip, limit + skip + 1).length > limit,
  };
};
