const { faker, Post } = require('test/testHelper');

const Create = async (data = {}) => {
  const postData = {
    id: data.id || 0,
    author: data.author || `${faker.name.firstName()}${faker.random.number()}`,
    permlink: data.permlink || 'permlink',
    parent_permlink: `${faker.name.firstName()}${faker.random.number()}`,
    parent_author: 'user',
    title: `${faker.name.firstName()}${faker.random.number()}`,
    body: `${faker.name.firstName()}${faker.random.number()}`,
    json_metadata: `${faker.name.firstName()}${faker.random.number()}`,
    active_votes: data.active_votes || [],
  };
  const post = new Post(postData);

  await post.save();
  return post.toObject();
};

module.exports = { Create };
