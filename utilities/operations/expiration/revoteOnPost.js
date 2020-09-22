const _ = require('lodash');
const moment = require('moment');
const { botUpvoteModel, matchBotModel } = require('models');
const matchBotHelper = require('utilities/helpers/matchBotHelper');
const steemHelper = require('utilities/helpers/steemHelper');
const { BOT_UPVOTE_STATUSES, MIN_TO_VOTE_VALUE } = require('constants/constants');

module.exports = async ({ author, permlink }) => {
  const { result: upvotes } = await botUpvoteModel.find(
    { author, permlink, status: BOT_UPVOTE_STATUSES.UPVOTED },
  );
  if (!upvotes.length) return;
  const post = await steemHelper.getPostInfo({ author, permlink });
  if (!post.author || moment.utc(post.created).add(7, 'days').toDate() < moment.utc().toDate()) return;
  const botNames = _.map(upvotes, 'botName');
  /** Exit from method without downvotes on post */
  const downvoteWeight = _.sumBy(post.active_votes, (vote) => {
    if (vote.percent < 0) return -(+vote.rshares);
  });
  if (!downvoteWeight) return;
  /** If pending payout at post eq 0, unvote by all
   matchbots (if downvote> upvote we cant count post reward) */
  if (parseFloat(post.pending_payout_value) === 0) {
    return unVoteOnPost({ author, permlink, botNames });
  }
  const upvoteWeight = _.sumBy(post.active_votes, (vote) => {
    if (vote.percent > 0) return +vote.rshares;
  });
  const oneHBDRshares = (upvoteWeight - downvoteWeight) / parseFloat(post.pending_payout_value);
  const toVoteValue = downvoteWeight / oneHBDRshares;
  const { currentPrice } = await steemHelper.getCurrentPriceInfo();
  await toVoteOnPost({
    author, permlink, toVoteValue: toVoteValue / currentPrice, upvotes, botNames,
  });
};

const unVoteOnPost = async ({ author, permlink, botNames }) => {
  for (const bot of botNames) {
    await steemHelper.likePost({
      key: process.env.UPVOTE_BOT_KEY, voter: bot, author, permlink, weight: 0,
    });
  }
};

const toVoteOnPost = async ({
  author, permlink, toVoteValue, upvotes, botNames,
}) => {
  if (toVoteValue < MIN_TO_VOTE_VALUE) return;
  const { result: matchBots } = await matchBotModel.find({
    bot_name: { $in: botNames },
    sponsors: {
      $elemMatch: {
        sponsor_name: upvotes[0].sponsor,
        enabled: true,
        $or: [{ expiredAt: { $gt: new Date() } }, { expiredAt: null }],
      },
    },
  });
  if (!_.get(matchBots, 'length')) return;
  let maxToVoteValue = 0;
  let availableBots = [];
  for (const bot of matchBots) {
    const upvote = _.find(upvotes, { botName: bot.bot_name });
    if (upvote.votePercent === 10000) continue;
    /** In future we may need to check current currentVotePower with permissions */
    const { currentVotePower, voteWeight } = await steemHelper.getVotingInfo(bot.bot_name, 100, author, permlink);
    if (voteWeight > upvote.currentVote)maxToVoteValue += voteWeight - upvote.currentVote;
    else continue;
    upvote.voteWeight = voteWeight - upvote.currentVote;
    availableBots.push(upvote);
  }
  if (maxToVoteValue === 0) return;
  if ((upvotes[0].totalVotesWeight - toVoteValue + maxToVoteValue) < upvotes[0].totalVotesWeight / 2) {
    return unVoteOnPost({ botNames, permlink, author });
  }
  availableBots = _.orderBy(availableBots, ['voteWeight'], ['desc']);
  for (const bot of availableBots) {
    if (bot.voteWeight > toVoteValue) {
      bot.amountToVote = bot.currentVote + toVoteValue;
      const { votePower } = await matchBotHelper.getNeededVoteWeight(bot.voteWeight, bot);
      await steemHelper.likePost({
        voter: bot.botName,
        author,
        permlink,
        weight: votePower,
        key: process.env.UPVOTE_BOT_KEY,
      });
      return;
    }
    await steemHelper.likePost({
      voter: bot.botName,
      author,
      permlink,
      weight: 10000,
      key: process.env.UPVOTE_BOT_KEY,
    });
    toVoteValue -= (bot.voteWeight - bot.currentVote);
  }
};
