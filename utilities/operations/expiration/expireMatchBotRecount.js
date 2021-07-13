const _ = require('lodash');
const { redisSetter, redisGetter } = require('utilities/redis');
const { campaignModel, botUpvoteModel } = require('models');
const mathBotHelper = require('utilities/helpers/matchBotHelper');
const { BOT_UPVOTE_STATUSES } = require('constants/constants');
const { RECALCULATION_DEBT } = require('constants/ttlData');
const { hiveClient, hiveOperations } = require('utilities/hiveApi');
const { getRewardUSD } = require('utilities/helpers/paymentsHelper');
const { divide, multiply } = require('utilities/helpers/calcHelper');

/** Listen for expire posts for match bot recount */
module.exports = async ({ author, permlink, voter }) => {
  const { weight, voteValue: voteWeight, metadata } = await hiveClient.execute(
    hiveOperations.getVoteValue,
    { author, permlink, voter },
  );
  const guestAuthor = mathBotHelper.checkForGuest('', metadata);
  const { result: campaign } = await campaignModel.findOne(
    { payments: { $elemMatch: { userName: guestAuthor || author, postPermlink: permlink } } },
  );
  if (!campaign) return;

  const { result: botUpvote } = await botUpvoteModel.findOne({ botName: voter, author, permlink });
  if (!botUpvote) {
    if (voteWeight <= 0) return;
    const { result } = await redisGetter.getTTLData(`expire:${RECALCULATION_DEBT}|${author}|${permlink}`);
    if (!result) {
      const post = await hiveClient.execute(hiveOperations.getPostInfo, { author, permlink });
      if (post.author) {
        const timer = Math.round(new Date(post.cashout_time).valueOf() / 1000)
          - Math.round(new Date().valueOf() / 1000) + 11200;

        await redisSetter.saveTTL(`expire:${RECALCULATION_DEBT}|${author}|${permlink}`, timer);
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
    currentVote: _.round(voteWeight, 3),
    status: BOT_UPVOTE_STATUSES.UPVOTED,
    id: botUpvote._id,
    votePercent: weight,
  });
  if (botUpvote.status === BOT_UPVOTE_STATUSES.UPVOTED && botUpvote.executed) {
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

  const user = _.find(campaign.users, (record) => record._id.toString() === payment.reservationId.toString());
  if (!user) return;

  const { result: anotherUpvote } = await botUpvoteModel.findOne({ author, permlink });
  if (anotherUpvote) {
    await botUpvoteModel.update({ author, permlink }, { $inc: { totalVotesWeight: voteWeight } });
  }

  const usdReward = getRewardUSD({
    reward: campaign.rewardInCurrency, currency: campaign.currency,
  });

  const { result: bot } = await botUpvoteModel.create({
    author,
    permlink,
    status: BOT_UPVOTE_STATUSES.UPVOTED,
    votePercent: weight,
    botName: voter,
    amountToVote: multiply(divide(usdReward, user.hiveCurrency), 2),
    sponsor: campaign.guideName,
    requiredObject: campaign.requiredObject,
    reward: divide(multiply(usdReward, 2), user.hiveCurrency, 3),
    currentVote: voteWeight,
    reservationPermlink: user.permlink,
    totalVotesWeight: _.get(anotherUpvote, 'totalVotesWeight') ? anotherUpvote.totalVotesWeight + voteWeight : voteWeight,
  });

  if (campaign.compensationAccount && bot) {
    await mathBotHelper.updateCompensationFee(bot, campaign, _.round(voteWeight / 2, 3));
  }
};
