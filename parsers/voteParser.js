const _ = require('lodash');
const moment = require('moment');
const steemHelper = require('utilities/helpers/steemHelper');
const { MATCH_BOT_VOTE, DOWNVOTE_ON_REVIEW } = require('constants/ttlData');
const { campaignModel } = require('models');
const { redisSetter, redisGetter } = require('utilities/redis');

exports.parse = async (votes) => {
  await Promise.all(votes.map(async (vote) => {
    const { result: campaign } = await campaignModel.findOne({
      $or: [{ guideName: vote.voter }, { match_bots: vote.voter }],
      payments: { $elemMatch: { postPermlink: vote.permlink, rootAuthor: vote.author } },
    });
    /** If voter not match-bot and weight <0 parse downvotes for recount vote */
    if (!campaign && vote.weight < 0) {
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
      await redisSetter.setSimpleTtl(`expire:${DOWNVOTE_ON_REVIEW}|${vote.author}|${vote.permlink}`, ttlTime);
      /** If voter match-bot - parse manual votes */
    } else if (campaign) {
      await redisSetter.setSimpleTtl(`expire:${MATCH_BOT_VOTE}|${vote.author}|${vote.permlink}|${vote.voter}`, 20);
    }
  }));
};
