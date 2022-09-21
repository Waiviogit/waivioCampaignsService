const {
  botUpvoteModel,
  campaignModel,
  postModel,
} = require('models');
const matchBotHelper = require('utilities/helpers/matchBotHelper');
const moment = require('moment');
const _ = require('lodash');

exports.removeVotes = async () => {
  const { campaigns } = await campaignModel.find({
    payments: {
      $elemMatch: {
        status: 'rejected',
        createdAt: { $gte: moment.utc().subtract(7, 'days').toDate() },
      },
    },

  },
  {},
  { payments: 1 });

  const payments = [];
  for (const campaign of campaigns) payments.push(..._.filter(campaign.payments, (p) => p.status = 'rejected'));
  for (const payment of payments) {
    const upvotes = await botUpvoteModel.getExpiredUpvotes(payment.postPermlink);
    if (_.isEmpty(upvotes)) continue;
    const { post } = await postModel
      .getOne({ author: payment.rootAuthor, permlink: payment.postPermlink });
    if (!post) continue;
    const activeVotes = _.filter(post.active_votes, (v) => v.percent > 0);
    const filtered = _.filter(upvotes, (u) => _.some(activeVotes, (p) => p.voter === u.botName));
    for (const upvote of filtered) {
      await matchBotHelper.removeVote(upvote);
      console.log(`${upvote.botName} removed vote on ${payment.rootAuthor}, ${payment.postPermlink}`);
    }
  }
};
