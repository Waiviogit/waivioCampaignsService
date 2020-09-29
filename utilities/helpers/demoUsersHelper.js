const getDemoDebtHistory = require('utilities/operations/paymentHistory/getDemoDebtHistory');
const steemHelper = require('./steemHelper');

exports.transfer = async ({
  demoUser, to, amount, memo, id = 'demo_user_transfer', app,
}) => {
  const fromData = await steemHelper.getAccountInfo(process.env.WALLET_ACC_NAME);
  const { payable } = await getDemoDebtHistory(
    { userName: demoUser, limit: 0 },
  );

  if (amount > payable) return { error: 'The amount more than dept' };
  if (amount > fromData.balance.match(/.\d*.\d*/)[0]) return { error: 'Not enough balance' };
  const demoMemo = app ? `{"id":"${id}", "from":"${demoUser}","to":"${to}", "message":"${memo}", "app": "${app}"`
    : `{"id":"${id}", "from":"${demoUser}","to":"${to}", "message":"${memo}"}`;

  return steemHelper.transfer({
    from: process.env.WALLET_ACC_NAME,
    to,
    amount,
    activeKey: process.env.WALLET_ACC_KEY,
    memo: demoMemo,
  });
};
