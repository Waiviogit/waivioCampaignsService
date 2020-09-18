const { faker } = require('test/testHelper');

const getMocksData = async (data) => {
  const operation = {
    from: data.from || faker.name.firstName().toLowerCase(),
    to: data.to || faker.name.firstName().toLowerCase(),
    amount: data.amount || 0.001,
    memo: data.memo || '',
  };

  return { operation };
};

module.exports = { getMocksData };
