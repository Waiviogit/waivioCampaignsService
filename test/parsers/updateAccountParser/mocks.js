const { faker } = require('test/testHelper');

const getMocksData = async (data) => {
  const operation = {
    account: data.account || faker.name.firstName(),
    json_metadata: data.json_metadata || { app: 'waivio', profile: {} },
    posting: {
      account_auths: data.account_auths || [['busy.app', 1]],
    },
  };

  return { operation };
};

module.exports = { getMocksData };
