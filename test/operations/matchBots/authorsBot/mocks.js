const { faker, _ } = require('test/testHelper');

exports.getPostData = (data = {}) => ({
  parent_author: data.parent_author || '',
  parent_permlink: data.parent_permlink || faker.random.string(),
  author: data.author || faker.random.string(),
  permlink: data.permlink || faker.random.string(),
});

exports.getVoteData = (data = {}) => {
  const vote = {
    author: data.author || faker.random.string(),
    permlink: data.permlink || faker.random.string(),
    voter: data.botName || faker.random.string(),
    minVotingPower: data.minVotingPower || _.random(1, 10000),
    votingPercent: data.votingPercent || _.random(0.01, 1),
  };
  if (data.stringify) return JSON.stringify(vote);
  return vote;
};
