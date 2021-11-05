const { TOKEN_WAIV, REDIS_ENGINE_CURATORS } = require('constants/hiveEngine');
const { engineCuratorBotQueue } = require('utilities/redis/queues');
const redisGetter = require('utilities/redis/redisGetter');
const { BOTS_QUEUE } = require('constants/matchBotsData');
const { postModel } = require('models');
const _ = require('lodash');

exports.processEngineCuratorMatchBot = async (votes) => {
  const curators = await redisGetter.smembers(`${REDIS_ENGINE_CURATORS}:${TOKEN_WAIV.SYMBOL}`);
  const filteredCuratorsVotes = _.filter(votes, (el) => _.includes(curators, el.voter));
  if (_.isEmpty(filteredCuratorsVotes)) return;
  const { posts } = await postModel.find(
    {
      $or: _.map(filteredCuratorsVotes, (el) => ({
        root_author: el.author, permlink: el.permlink, 'wobjects.author_permlink': { $in: TOKEN_WAIV.TAGS },
      })),
    },
    {
      root_author: 1, permlink: 1, _id: 0,
    },
  );
  if (_.isEmpty(posts)) return;
  const filteredCuratorsByTag = _.filter(
    filteredCuratorsVotes,
    (v) => _.some(posts, (p) => p.root_author === v.author && p.permlink === v.permlink),
  );
  if (_.isEmpty(filteredCuratorsByTag)) return;
  const uniqueVotes = _
    .chain(filteredCuratorsByTag)
    .orderBy(['weight'], ['desc'])
    .uniqWith((a, b) => a.permlink === b.permlink && a.author === b.author)
    .value();

  for (const uniqueVote of uniqueVotes) {
    await engineCuratorBotQueue.send(JSON.stringify(uniqueVote), BOTS_QUEUE.ENGINE_CURATOR.DELAY);
  }
};
