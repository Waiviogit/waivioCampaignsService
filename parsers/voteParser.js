const _ = require('lodash');
const { campaignModel } = require('models');
const { redisSetter } = require('utilities/redis');

exports.parse = async (votes) => {
  let names = [];
  if (!votes.length) return;
  const { result: campaigns } = await campaignModel.aggregate(campaignPipeline());
  if (campaigns && campaigns.length) {
    names = _.uniq(_.flattenDeep(_.concat(campaigns[0].matchBots, campaigns[0].guideNames)));
    if (!names && !names.length) return;
  }
  await Promise.all(votes.map(async (vote) => {
    if (!_.includes(names, vote.voter)) return;
    const { result } = await campaignModel.findOne(
      { payments: { $elemMatch: { postPermlink: vote.permlink, rootAuthor: vote.author } } },
    );
    if (!result) return;
    await redisSetter.setMatchBotExpire({
      author: vote.author, permlink: vote.permlink, voter: vote.voter,
    });
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
