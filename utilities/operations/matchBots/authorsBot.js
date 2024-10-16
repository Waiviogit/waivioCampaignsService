const {
  MATCH_BOT_TYPES, BOTS_QUEUE, BOT_ENV_KEY, WORK_BOTS_ENV,
} = require('constants/matchBotsData');
const { authorsBotQueue } = require('utilities/redis/queues');
const validators = require('controllers/validators');
const { extendedMatchBotModel } = require('models');
const _ = require('lodash');
const { parseJson } = require('../../helpers/jsonHelper');
const { verifySignature, VERIFY_SIGNATURE_TYPE } = require('../../helpers/signatureHelper');

exports.processAuthorsMatchBot = async (post) => {
  if (!_.includes(WORK_BOTS_ENV, process.env.NODE_ENV)) return;

  const metadata = parseJson(post.json_metadata, null);
  const guestName = metadata?.comment?.usedId;
  const name = guestName || post.author;

  if (post.parent_author) return { result: false };
  const accountsCondition = { accounts: { $elemMatch: { name, enabled: true } } };
  const { result: bots } = await extendedMatchBotModel.find(
    { $and: [accountsCondition, { type: MATCH_BOT_TYPES.AUTHOR }] },
    { ...accountsCondition, botName: 1 },
  );
  if (_.isEmpty(bots)) return { result: false };

  if (guestName) {
    const validSignature = await verifySignature({
      operation: post, type: VERIFY_SIGNATURE_TYPE.COMMENT,
    });
    if (!validSignature) return { result: false };
  }
  return this.sendToAuthorsQueue({ post, bots });
};

exports.sendToAuthorsQueue = async ({ post, bots }) => {
  for (const bot of bots) {
    const { params, validationError } = validators
      .validate(getAuthorVoteData({ post, bot }), validators.matchBots.matchBotVoteSchema);
    if (validationError) {
      continue;
    }

    authorsBotQueue.send(JSON.stringify(params), BOTS_QUEUE.AUTHOR.DELAY);
  }
};

const getAuthorVoteData = ({ post, bot }) => ({
  minVotingPowerCurrencies: _.get(bot, 'accounts[0].minVotingPowerCurrencies'),
  minVotingPower: _.get(bot, 'accounts[0].minVotingPower'),
  voteWeight: _.get(bot, 'accounts[0].voteWeight'),
  minHBD: BOTS_QUEUE.AUTHOR.MIN_HBD,
  botKey: BOT_ENV_KEY.AUTHOR,
  permlink: post.permlink,
  author: post.author,
  voter: bot.botName,
});
