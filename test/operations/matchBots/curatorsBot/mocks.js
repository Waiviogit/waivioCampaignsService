const { faker, _ } = require('test/testHelper');

exports.getVoteData = (data = {}) => {
  const vote = {
    author: data.author || faker.random.string(),
    permlink: data.permlink || faker.random.string(),
    voter: data.botName || faker.random.string(),
    weight: data.weight || _.random(-10000, 10000),
  };
  if (data.stringify) return JSON.stringify(vote);
  return vote;
};
