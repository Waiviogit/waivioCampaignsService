const { BotUpvote } = require('database').models;
const moment = require('moment');

/**
 * create record in database for upvote which will be created by match bot
 * @param author {string}
 * @param sponsor {string}
 * @param botName {string}
 * @param currentVote {number}
 * @param permlink {string}
 * @param reward {number}
 * @param reservationPermlink {string}
 * @param requiredObject {string}
 * @param status {string}
 * @param votePercent {number}
 * @param totalVotesWeight {number}
 * @param amountToVote
 * @returns {Promise<{result: *}|{error: *}>}
 */
const create = async ({
  author, sponsor, permlink, reward,
  reservationPermlink, requiredObject, botName, currentVote = 0,
  status = 'pending', votePercent = 0, totalVotesWeight = 0, amountToVote,
}) => {
  try {
    const bot = await BotUpvote.create({
      currentVote,
      totalVotesWeight,
      reservationPermlink,
      amountToVote,
      votePercent,
      requiredObject,
      botName,
      author,
      status,
      sponsor,
      permlink,
      reward,
      startedAt: moment.utc().add(30, 'minutes'),
      expiredAt: moment.utc().add(7, 'days'),
    });

    return { result: bot };
  } catch (error) {
    return { error };
  }
};

/**
 * Aggregate all upvotes with status pending
 * @returns {Promise<Aggregate>}
 */
const getUpvotes = async () => BotUpvote.aggregate([
  { $group: { _id: '$botName', upvotes: { $push: '$$ROOT' } } },
  {
    $addFields: {
      upvote: {
        $arrayElemAt: [{
          $filter: {
            input: '$upvotes',
            as: 'upvote',
            cond: { $eq: ['$$upvote.status', 'pending'] },
          },
        }, 0],
      },
    },
  },
  { $match: { 'upvote.startedAt': { $lte: moment.utc().toDate() }, 'upvote.expiredAt': { $gte: moment.utc().subtract(30, 'minutes').toDate() } } },
  {
    $lookup: {
      from: 'match_bots', localField: '_id', foreignField: 'bot_name', as: 'bot',
    },
  },
  { $unwind: '$bot' },
  {
    $addFields: {
      sponsor: {
        $arrayElemAt: [{
          $filter: {
            input: '$bot.sponsors',
            as: 'sponsor',
            cond: {
              $eq: ['$$sponsor.sponsor_name', '$upvote.sponsor'],
            },
          },
        }, 0],
      },
    },
  },
  { $match: { 'sponsor.enabled': true } },
  {
    $project: {
      _id: '$upvote._id',
      bot_name: '$bot.bot_name',
      sponsor: '$sponsor.sponsor_name',
      voting_percent: '$sponsor.voting_percent',
      min_voting_power: '$bot.min_voting_power',
      author: '$upvote.author',
      permlink: '$upvote.permlink',
      reward: '$upvote.reward',
      totalVotesWeight: '$upvote.totalVotesWeight',
      requiredObject: '$upvote.requiredObject',
      amountToVote: '$upvote.amountToVote',
      reservationPermlink: '$upvote.reservationPermlink',
    },
  },
]);

/**
 * Return all bots expired upvotes
 * @returns {Promise<Aggregate>}
 */
const getExpiredUpvotes = async (permlink = null) => {
  const pipeline = [
    { $match: { status: 'upvoted', executed: false } },
    {
      $project: {
        botName: 1,
        author: 1,
        permlink: 1,
        sponsor: 1,
        createdAt: 1,
        currentVote: 1,
        reservationPermlink: 1,
      },
    },
  ];
  if (permlink) pipeline[0].$match.permlink = permlink;
  return BotUpvote.aggregate(pipeline);
};

const updateStatus = async ({
  id, status, currentVote, votePercent,
}) => {
  try {
    const updateData = { $set: { status } };
    if (currentVote) updateData.$set.currentVote = currentVote;
    if (votePercent) updateData.$set.votePercent = votePercent;
    const result = await BotUpvote.updateOne(
      { _id: id }, updateData, { runValidators: true },
    );

    return { result: !!result.n };
  } catch (error) {
    return { error };
  }
};

const deleteOne = async (id) => {
  try {
    const result = await BotUpvote.deleteOne({ _id: id });

    return { result: !!result.n };
  } catch (error) {
    return { error };
  }
};

const update = async (condition, updateData) => {
  try {
    return { result: await BotUpvote.updateMany(condition, updateData) };
  } catch (error) {
    return { error };
  }
};
/**
 * Remove upvote record
 * @param id
 * @returns {Promise<void>}
 */
const removeOne = async ({ id }) => {
  await BotUpvote.deleteOne({ _id: id });
};

const findOne = async (condition) => {
  try {
    return { result: await BotUpvote.findOne(condition).lean() };
  } catch (error) {
    return { error };
  }
};

const find = async (condition) => {
  try {
    return { result: await BotUpvote.find(condition).lean() };
  } catch (error) {
    return { error };
  }
};

module.exports = {
  create,
  update,
  find,
  findOne,
  removeOne,
  updateStatus,
  getExpiredUpvotes,
  getUpvotes,
  deleteOne,
};
