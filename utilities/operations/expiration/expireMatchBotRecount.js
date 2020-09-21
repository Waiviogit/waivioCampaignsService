const _ = require('lodash');
const { redisSetter, redisGetter } = require('utilities/redis');
const { campaignModel, botUpvoteModel } = require('models');
const mathBotHelper = require('utilities/helpers/matchBotHelper');
const steemHelper = require('utilities/helpers/steemHelper');

/** Listen for expire posts for match bot recount */
module.exports = async ({ author, permlink, voter }) => {
  const { weight, voteValue: voteWeight, metadata } = await steemHelper.getVoteValue(
    { author, permlink, voter },
  );
  const guestAuthor = mathBotHelper.checkForGuest('', metadata);
  const campaign = await campaignModel.findOne(
    { payments: { $elemMatch: { userName: guestAuthor || author, postPermlink: permlink } } },
  );
  if (!campaign) return;

  const { result: botUpvote } = await botUpvoteModel.findOne({ botName: voter, author, permlink });
  if (!botUpvote) {
    if (voteWeight <= 0) return;
    const { result } = await redisGetter.getTTLData(`expire:recalculationDebt|${author}|${permlink}`);
    if (!result) {
      const post = await steemHelper.getPostInfo({ author, permlink });
      if (post.author) {
        const timer = Math.round(new Date(post.cashout_time).valueOf() / 1000)
          - Math.round(new Date().valueOf() / 1000) + 11200;

        await redisSetter.saveTTL(`expire:recalculationDebt|${author}|${permlink}`, timer);
      }
    }
    return createBotUpvoteRecord({
      voter, author, permlink, voteWeight, campaign, weight, guestAuthor,
    });
  }

  if (+botUpvote.votePercent === +weight) return;
  if (voteWeight <= 0) await botUpvoteModel.deleteOne(botUpvote._id);

  await botUpvoteModel.update({ author, permlink },
    { $inc: { totalVotesWeight: voteWeight > 0 ? voteWeight - botUpvote.currentVote : -botUpvote.currentVote } });
  await botUpvoteModel.updateStatus({
    currentVote: _.round(voteWeight, 3), status: 'upvoted', id: botUpvote._id, votePercent: weight,
  });
  if (botUpvote.status === 'upvoted' && botUpvote.executed) {
    await mathBotHelper.updateUpvotedRecord({
      botUpvote, voteWeight, votePercent: weight,
    });
  }
};

/*
In this case we find reservation permlink by searching for the created
debt and searching by the date of its creation in the array of users,
a record of the reservation by this user. Compare dates because the
user can run the campaign more than once.
Then if campaign has compensation account we create or update compensation
payment history be vote amount
 */
const createBotUpvoteRecord = async ({
  voter, author, permlink, voteWeight, campaign, weight, guestAuthor,
}) => {
  const payment = _.find(campaign.payments,
    (record) => record.userName === (guestAuthor || author) && record.postPermlink === permlink);
  if (!payment) return;

  const user = _.find(campaign.users,
    (record) => record.name === (guestAuthor || author) && record.status === 'completed'
      && Math.trunc(record.completedAt.valueOf() / 10000)
      === Math.trunc(payment.createdAt.valueOf() / 10000));
  if (!user) return;

  const { result: anotherUpvote } = await botUpvoteModel.findOne({ author, permlink });
  if (anotherUpvote) {
    await botUpvoteModel.update({ author, permlink }, { $inc: { totalVotesWeight: voteWeight } });
  }

  const { result: bot } = await botUpvoteModel.create({
    author,
    permlink,
    status: 'upvoted',
    votePercent: weight,
    botName: voter,
    amountToVote: (campaign.reward / user.hiveCurrency) * 2,
    sponsor: campaign.guideName,
    requiredObject: campaign.requiredObject,
    reward: _.round((campaign.reward * 2) / user.hiveCurrency, 3),
    currentVote: voteWeight,
    reservationPermlink: user.permlink,
    totalVotesWeight: _.get(anotherUpvote, 'totalVotesWeight') ? anotherUpvote.totalVotesWeight + voteWeight : voteWeight,
  });

  if (campaign.compensationAccount && bot) {
    await mathBotHelper.updateCompensationFee(bot, campaign, _.round(voteWeight / 2, 3));
  }
};
