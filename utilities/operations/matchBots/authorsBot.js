const { MATCH_BOT_TYPES, BOTS_QUEUE } = require('constants/matchBotsData');
const { hiveClient, hiveOperations } = require('utilities/hiveApi');
const { authorsBotQueue } = require('utilities/redis/queues');
const jsonHelper = require('utilities/helpers/jsonHelper');
const matchBotHelper = require('utilities/helpers/matchBotHelper');
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
      .validate(getAuthorVoteData({ post, bot }), validators.matchBots.authorMatchVoteSchema);
    if (validationError) continue; // #TODO Sentry

    authorsBotQueue.send(JSON.stringify(params), BOTS_QUEUE.AUTHOR.DELAY);
  }
};

exports.voteAuthorMatchBot = async (voteData) => {
  const { params, validationError } = validators
    .validate(jsonHelper.parseJson(voteData), validators.matchBots.authorMatchVoteSchema);
  if (validationError) console.log(validationError); // #TODO Sentry
  const {
    voter, author, permlink, votingPercent, minVotingPower,
  } = params;
  const canVote = await matchBotHelper.canVote({
    minHBD: BOTS_QUEUE.AUTHOR.MIN_HBD,
    voteWeight: votingPercent * 100,
    minVotingPower,
    name: voter,
    permlink,
    author,
  });
  if (!canVote) return;
  const { result: vote, error: votingError } = await hiveClient.execute(
    hiveOperations.likePost,
    {
      key: process.env.AUTHOR_BOT_KEY,
      weight: votingPercent * 10000,
      permlink,
      author,
      voter,
    },
  );
  if (votingError) console.log(votingError); // #TODO Sentry
};

const getAuthorVoteData = ({ post, bot }) => ({
  minVotingPower: _.get(bot, 'accounts[0].minVotingPower'),
  votingPercent: _.get(bot, 'accounts[0].votingPercent'),
  permlink: post.permlink,
  author: post.author,
  voter: bot.botName,
});
