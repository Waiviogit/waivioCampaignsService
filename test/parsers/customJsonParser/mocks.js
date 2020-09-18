
const getMocksData = async (data) => {
  const operation = {
    required_auths: [],
    required_posting_auths: [data.user],
    id: data.id || 'some_operation',
    json: JSON.stringify(data.json) || '{}',
  };

  return { operation };
};

module.exports = { getMocksData };
