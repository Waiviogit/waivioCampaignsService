const getDemoDebtHistory = require('utilities/operations/paymentHistory/getDemoDebtHistory');
const steemHelper = require('./steemHelper');

exports.transfer = async ({
  demoUser, to, amount, memo,
}) => {
  const fromData = await steemHelper.getAccountInfo(process.env.WALLET_ACC_NAME);
  const { payable } = await getDemoDebtHistory(
    { userName: demoUser, limit: 0 },
  );

  if (amount > payable) return { error: 'The amount more than dept' };
  if (amount > fromData.balance.match(/.\d*.\d*/)[0]) return { error: 'Not enough balance' };

  return steemHelper.transfer({
    from: process.env.WALLET_ACC_NAME,
    to,
    amount,
    activeKey: process.env.WALLET_ACC_KEY,
    memo: `{"id":"demo_user_transfer", "from":"${demoUser}","to":"${to}", "message":"${memo}"}`,
  });
};
