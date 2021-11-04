const redisGetter = require('utilities/redis/redisGetter');
const { TOKEN_WAIV, REDIS_ENGINE_CURATORS } = require('constants/hiveEngine');
const { postModel } = require('models');
const _ = require('lodash');

const votes = [
  {
    voter: 'curie',
    author: 'sandracarrascal',
    permlink: 'how-can-we-enhance-self-knowledge',
    weight: 550,
  },
  {
    voter: 'oy',
    author: 'sandracarrascal',
    permlink: 'how-can-we-enhance-self-knowledge',
    weight: 550,
  },
];

exports.processEngineCuratorMatchBot = async () => {
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
  console.log();
};
