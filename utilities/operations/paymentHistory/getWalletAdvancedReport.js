const { getWalletData } = require('utilities/helpers/walletHelper');
const _ = require('lodash');

module.exports = async ({
  users, startDate, endDate, types, limit, res,
}) => {
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.flushHeaders(); // flush the headers to establish SSE with client

  const accounts = _.reduce(users, (acc, el) => {
    acc[el] = {
      guest: !!el.match('_'),
      wallet: [],
      operationNum: -1,
      hasMore: true,
    };
    return acc;
  }, {});

  await sendData({
    accounts, startDate, endDate, types, limit, res,
  });
};
const sendData = async ({
  accounts, startDate, endDate, types, limit, res,
}) => {
  for (const account in accounts) {
    if (!accounts[account].hasMore) continue;
    accounts[account].guest
      ? accounts[account].wallet = []
      : accounts[account].wallet = await getWalletData({
        userName: account,
        tableView: true,
        limit: limit + 1,
        startDate,
        operationNum: accounts[account].operationNum,
        endDate,
        types,
      });
    accounts[account].hasMore = accounts[account].wallet.length > limit;
  }

  // send to front
  const resultArray = _
    .chain(accounts)
    .reduce((acc, el) => _.concat(acc, el.wallet), [])
    .orderBy(['timestamp'], ['desc'])
    .take(limit)
    .value();

  if (_.isEmpty(resultArray)) {
    res.write('event: end-of-stream\n');
    res.write('data: end\n');
    res.write('\n');
    res.end('Ok');
    return;
  }

  for (const account in accounts) {
    const lastOpNum = _.get(_.last(accounts[account].wallet), 'operationNum', 1);
    accounts[account].wallet = _.filter(
      accounts[account].wallet, (el) => !_.some(resultArray, (result) => _.isEqual(result, el)),
    );
    if (_.isEmpty(accounts[account].wallet) && accounts[account].hasMore === false) continue; // move up
    accounts[account].operationNum = _.isEmpty(accounts[account].wallet)
      ? lastOpNum - 1
      : _.get(accounts[account], 'wallet[0].operationNum');
  }

  res.write(`data: ${JSON.stringify(resultArray)}\n\n`);
  await sendData({
    accounts, startDate, endDate, types, limit, res,
  });
};
