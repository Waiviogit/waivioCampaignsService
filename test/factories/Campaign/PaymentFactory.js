const { faker, ObjectID } = require('test/testHelper');

const Create = async (data = {}) => ({
  reservationId: data.reservationId || new ObjectID(),
  campaignUserId: data.userId || new ObjectID(),
  userName: data.userName || `${faker.name.firstName()}${faker.random.number()}`,
  objectPermlink: data.objectPermlink || faker.lorem.word(),
  postTitle: data.postTitle || faker.lorem.word(),
  postPermlink: data.postPermlink || faker.lorem.word(),
  status: data.status || 'active',
  rootAuthor: data.userName || `${faker.name.firstName()}${faker.random.number()}`,
});

module.exports = { Create };
