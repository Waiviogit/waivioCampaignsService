const { faker, _ } = require('test/testHelper');

const getMocksData = async (data = {}) => {
  const operation = {
    parent_author: !_.isNull(data.parent_author)
      ? data.parent_author
      : faker.name.firstName().toLowerCase(),
    parent_permlink: data.parent_permlink || faker.lorem.word(),
    author: data.author || faker.name.firstName().toLowerCase(),
    permlink: data.permlink || faker.lorem.word(),
    title: data.title || faker.lorem.word(),
    body: data.body || faker.lorem.word(),
    json_metadata: data.metadata || '',

  };

  return { operation };
};

module.exports = { getMocksData };
