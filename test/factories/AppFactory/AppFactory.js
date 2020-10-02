const _ = require('lodash');
const { faker, App } = require('test/testHelper');

const Create = async ({
  name, admins, moderators, blackList, onlyData, ingredients, referral, indexCommission,
  indexAcc, campaignCommission, campaignAcc, authority, host, owner,
} = {}) => {
  const data = {
    host: host || faker.internet.domainName(),
    owner: owner || faker.name.firstName(),
    name: name || faker.random.string(10),
    admins: admins || [faker.name.firstName().toLowerCase()],
    moderators: moderators || [],
    black_list_users: blackList || [],
    daily_chosen_post: {
      author: faker.name.firstName().toLowerCase(),
      permlink: faker.random.string(),
      title: faker.random.string(20),
    },
    authority: authority || [],
    weekly_chosen_post: {
      author: faker.name.firstName().toLowerCase(),
      permlink: faker.random.string(),
      title: faker.random.string(20),
    },
    supported_objects: [],
    supported_object_types: [],
    tagsData: {
      Ingredients: ingredients || {
        apple: 'apple',
      },
    },
    app_commissions: {
      campaigns_server_acc: campaignAcc || faker.name.firstName(),
      campaigns_percent: _.isNumber(campaignCommission) ? campaignCommission : 0.3,
      index_commission_acc: indexAcc || faker.name.firstName(),
      index_percent: _.isNumber(indexCommission) ? indexCommission : 0.2,
      referral_commission_acc: referral || faker.name.firstName(),
    },
  };
  if (onlyData) {
    return data;
  }

  await App.create(data);
  return data;
};

module.exports = { Create };
