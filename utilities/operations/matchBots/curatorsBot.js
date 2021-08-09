const {
  MATCH_BOT_TYPES, BOTS_QUEUE, BOT_ENV_KEY, WORK_BOTS_ENV,
} = require('constants/matchBotsData');
const sentryHelper = require('utilities/helpers/sentryHelper');
const { curatorsBotQueue } = require('utilities/redis/queues');
const validators = require('controllers/validators');
const { extendedMatchBotModel } = require('models');
const _ = require('lodash');

exports.processCuratorsMatchBot = async (vote) => {
  // if (_.includes(WORK_BOTS_ENV, process.env.NODE_ENV)) return;
  const accountsCondition = { accounts: { $elemMatch: { name: vote.voter, enabled: true } } };
  const { result: bots } = await extendedMatchBotModel.find(
    { $and: [accountsCondition, { type: MATCH_BOT_TYPES.CURATOR }] },
    { ...accountsCondition, botName: 1 },
  );
  if (_.isEmpty(bots)) return { result: false };
  return this.sendToCuratorsQueue({ vote, bots });
};

exports.sendToCuratorsQueue = async ({ vote, bots }) => {
  for (const bot of bots) {
    if (vote.weight < 0 && !_.get(bot, 'accounts[0].enablePowerDown')) continue;
    const { params, validationError } = validators
      .validate(getCuratorVoteData({ vote, bot }), validators.matchBots.matchBotVoteSchema);
    if (validationError) {
      await sentryHelper.handleError(validationError);
      continue;
    }

    curatorsBotQueue.send(JSON.stringify(params), BOTS_QUEUE.CURATOR.DELAY);
  }
};

const getCuratorVoteData = ({ vote, bot }) => ({
  voteWeight: getWeightFromRatio({ curatorWeight: vote.weight, ratio: _.get(bot, 'accounts[0].voteRatio') }),
  minVotingPower: _.get(bot, 'accounts[0].minVotingPower'),
  voteComments: _.get(bot, 'accounts[0].voteComments', false),
  minHBD: BOTS_QUEUE.CURATOR.MIN_HBD,
  botKey: BOT_ENV_KEY.CURATOR,
  permlink: vote.permlink,
  author: vote.author,
  voter: bot.botName,
});

const getWeightFromRatio = ({ curatorWeight, ratio }) => {
  const weight = curatorWeight * ratio;
  if (Math.abs(weight) > 10000) {
    const sign = Math.sign(weight);
    if (sign === -1) return -10000;
    if (sign === 1) return 10000;
    return 0;
  }
  return parseInt(weight, 10);
};
