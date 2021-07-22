const { MATCH_BOT_TYPES, BOTS_QUEUE, BOT_ENV_KEY } = require('constants/matchBotsData');
const { authorsBotQueue } = require('utilities/redis/queues');
const validators = require('controllers/validators');
const { extendedMatchBotModel } = require('models');
const _ = require('lodash');

exports.processAuthorsMatchBot = async (post) => {
  if (post.parent_author) return;
  const accountsCondition = { accounts: { $elemMatch: { name: post.author, enabled: true } } };
  const { result: bots } = await extendedMatchBotModel.find(
    { $and: [accountsCondition, { type: MATCH_BOT_TYPES.AUTHOR }] },
    { ...accountsCondition, botName: 1 },
  );
  if (_.isEmpty(bots)) return;
  return this.sendToAuthorsQueue({ post, bots });
};

exports.sendToAuthorsQueue = async ({ post, bots }) => {
  for (const bot of bots) {
    const { params, validationError } = validators
      .validate(getAuthorVoteData({ post, bot }), validators.matchBots.matchBotVoteSchema);
    if (validationError) continue; // #TODO Sentry

    authorsBotQueue.send(JSON.stringify(params), BOTS_QUEUE.AUTHOR.DELAY);
  }
};

const getAuthorVoteData = ({ post, bot }) => ({
  minVotingPower: _.get(bot, 'accounts[0].minVotingPower'),
  voteWeight: _.get(bot, 'accounts[0].voteWeight'),
  minHBD: BOTS_QUEUE.AUTHOR.MIN_HBD,
  botKey: BOT_ENV_KEY.AUTHOR,
  permlink: post.permlink,
  author: post.author,
  voter: bot.botName,
});
