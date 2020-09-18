const { faker, Subscriptions } = require('test/testHelper');

const Create = async (data = {}) => {
  const subscriptionData = {
    follower: data.follower || `${faker.name.firstName()}${faker.random.number()}`,
    following: data.following || `${faker.name.firstName()}${faker.random.number()}`,
  };

  const subscription = new Subscriptions(subscriptionData);

  await subscription.save();
  return subscription.toObject();
};

module.exports = { Create };
