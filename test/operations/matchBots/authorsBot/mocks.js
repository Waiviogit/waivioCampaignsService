const { faker, _ } = require('test/testHelper');

exports.getPostData = (data = {}) => {
  const post = {
    parent_author: data.parent_author || '',
    parent_permlink: data.parent_permlink || faker.random.string(),
    author: data.author || faker.random.string(),
    permlink: data.permlink || faker.random.string(),
  };
  if (data.remove) {
    delete post[data.remove];
  }
  return post;
};

exports.getBotData = (data = {}) => {
  const botData = {
    botName: data.botName || faker.random.string(),
    accounts: [
      {
        minVotingPower: data.minVotingPower || _.random(1, 10000),
        voteWeight: data.voteWeight || _.random(1, 10000),
      },
    ],
  };
  if (data.remove) {
    delete botData.accounts[0][data.remove];
  }
  return botData;
};
