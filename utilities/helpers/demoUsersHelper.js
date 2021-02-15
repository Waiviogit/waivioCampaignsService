const getDemoDebtHistory = require('utilities/operations/paymentHistory/getDemoDebtHistory');
const { hiveClient, hiveOperations } = require('utilities/hiveApi');

exports.transfer = async ({
  demoUser, data, id = 'demo_user_transfer', app,
}) => {
  const fromData = await hiveClient.execute(
    hiveOperations.getAccountInfo,
    process.env.WALLET_ACC_NAME,
  );
  const { payable } = await getDemoDebtHistory(
    { userName: demoUser, limit: 0 },
  );

  if (data.amount > payable) return { error: 'The amount more than dept' };
  if (data.amount > fromData.balance.match(/.\d*.\d*/)[0]) return { error: 'Not enough balance' };
  const demoMemo = app ? `{"id":"${id}", "from":"${demoUser}","to":"${data.to}", "message":"${data.memo}", "app": "${app}"}`
    : `{"id":"${id}", "from":"${demoUser}","to":"${data.to}", "message":"${data.memo}"}`;

  return hiveClient.execute(
    hiveOperations.transfer,
    {
      from: process.env.WALLET_ACC_NAME,
      to: data.to,
      amount: data.amount,
      activeKey: process.env.WALLET_ACC_KEY,
      memo: demoMemo,
    },
  );
};
