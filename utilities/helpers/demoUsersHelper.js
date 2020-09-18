const getDemoDebtHistory = require('utilities/operations/paymentHistory/getDemoDebtHistory');
const { demoTransferBot: transferBot } = require('constants/constants');
const steemHelper = require('./steemHelper');

exports.transfer = async ({
  demoUser, to, amount, memo,
}) => {
  const fromData = await steemHelper.getAccountInfo(transferBot.userName);
  const { payable } = await getDemoDebtHistory(
    { userName: demoUser, limit: 0 },
  );

  if (amount > payable) return { error: 'The amount more than dept' };
  if (amount > fromData.balance.match(/.\d*.\d*/)[0]) return { error: 'Not enough balance' };

  return steemHelper.transfer(
    {
      from: transferBot.userName,
      to,
      amount,
      activeKey: transferBot.activeKey,
      memo: `{"id":"demo_user_transfer", "from":"${demoUser}","to":"${to}", "message":"${memo}"}`,
    },
  );
};
