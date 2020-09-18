const { faker, ObjectID, User } = require('test/testHelper');

const Create = async (data = {}) => {
  const userData = {
    name: data.name || `${faker.name.firstName()}${faker.random.number()}`,
    alias: data.alias,
    users_follow: data.users_follow || ['user1', 'user2'],
    count_posts: data.count_posts || 0,
    wobjects_weight: data.wobjects_weight || 0,
    followers_count: data.followers_count || 0,
    _id: data.id || new ObjectID(),
    user_metadata: data.userMetadata || null,
    privateEmail: data.privateEmail || null,
    objects_follow: data.objects_follow || [],
    referral: data.referral || [],
  };
  const user = new User(userData);

  await user.save();
  return user.toObject();
};

module.exports = { Create };
