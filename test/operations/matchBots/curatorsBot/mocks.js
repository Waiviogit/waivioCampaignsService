const { faker, _ } = require('test/testHelper');

exports.getVoteData = (data = {}) => {
  const vote = {
    author: data.author || faker.random.string(),
    permlink: data.permlink || faker.random.string(),
    voter: data.botName || faker.random.string(),
    weight: data.weight || _.random(-10000, 10000),
  };
  if (data.stringify) return JSON.stringify(vote);
  if (data.remove) {
    delete vote[data.remove];
  }
  return vote;
};

exports.getBotData = (data = {}) => {
  const botData = {
    botName: data.botName || faker.random.string(),
    accounts: [
      {
        minVotingPower: data.minVotingPower || _.random(1, 10000),
        voteRatio: data.voteRatio || _.random(0.01, 10),
      },
    ],
  };
  if (data.remove) {
    delete botData.accounts[0][data.remove];
  }
  if (data.enablePowerDown) {
    botData.accounts[0].enablePowerDown = true;
  }
  return botData;
};
