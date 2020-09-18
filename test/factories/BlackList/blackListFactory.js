const { Blacklist, faker } = require('test/testHelper');

exports.Create = async ({
  user, blackList, whiteList, follow, onlyData,
} = {}) => {
  const data = {
    user: user || faker.random.string(10),
    followLists: follow || [],
    blackList: blackList || [],
    whiteList: whiteList || [],
  };
  if (onlyData) return data;
  const result = await Blacklist.create(data);
  return result.toObject();
};
