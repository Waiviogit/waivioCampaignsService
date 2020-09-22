const _ = require('lodash');
const moment = require('moment');
const steemHelper = require('utilities/helpers/steemHelper');
const { MATCH_BOT_VOTE, DOWNVOTE_ON_REVIEW } = require('constants/ttlData');
const { campaignModel } = require('models');
const { redisSetter, redisGetter } = require('utilities/redis');

exports.parse = async (votes) => {
  let names = [];
  if (!votes.length) return;
  const { result: campaigns } = await campaignModel.aggregate(campaignPipeline());
  if (campaigns && campaigns.length) {
    names = _.uniq(_.flattenDeep(_.concat(campaigns[0].matchBots, campaigns[0].guideNames)));
    if (!names && !names.length) return;
  }
  await Promise.all(votes.map(async (vote) => {
    /** If voter not match-bot and weight <0 parse downvotes for recount vote */
    if (!_.includes(names, vote.voter) && vote.weight < 0) {
      const { result } = await campaignModel.findOne({
        payments: { $elemMatch: { postPermlink: vote.permlink, rootAuthor: vote.author } },
      });
      const { result: existedTTL } = await redisGetter.getTTLData(`${DOWNVOTE_ON_REVIEW}|${vote.author}|${vote.permlink}`);
      if (!result || _.isString(existedTTL)) return;

      const post = await steemHelper.getPostInfo({ author: vote.author, permlink: vote.permlink });
      if (!post.author || moment.utc(post.created) < moment.utc().subtract(7, 'days')) return;

      const expirationTime = moment.utc(post.created).add(165, 'hours').valueOf();
      const ttlTime = Math.round((expirationTime - moment.utc().valueOf()) / 1000);
      if (ttlTime < 0) return;
      await redisSetter.setSimpleTtl(`${DOWNVOTE_ON_REVIEW}|${vote.author}|${vote.permlink}`, ttlTime);
      /** If voter match-bot - parse manual votes */
    } else {
      const { result } = await campaignModel.findOne({
        $or: [{ guideName: vote.voter }, { match_bots: vote.voter }],
        payments: { $elemMatch: { postPermlink: vote.permlink, rootAuthor: vote.author } },
      });
      if (!result) return;
      await redisSetter.setSimpleTtl(`${MATCH_BOT_VOTE}|${vote.author}|${vote.permlink}|${vote.voter}`, 20);
    }
  }));
};

const campaignPipeline = () => [
  { $match: { users: { $elemMatch: { status: 'completed' } } } },
  {
    $group: {
      _id: null,
      guideNames: { $push: '$guideName' },
      matchBots: { $push: '$match_bots' },
    },
  },
];

// (async () => {
//   await this.parse([{
//     voter: 'mack-bot', author: 'vanguide', permlink: 'review-kisamos-greek-taverna-greek-salad', weight: -1000,
//   }]);
//   console.log();
// })();
