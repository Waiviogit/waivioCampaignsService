const _ = require('lodash');
const {
  Campaign, PaymentHistory, UserWobjects,
} = require('database').models;
const {
  botUpvoteModel, withdrawFundsModel, campaignModel, paymentHistoryModel,
} = require('models');
const steemHelper = require('utilities/helpers/steemHelper');
const matchBotHelper = require('utilities/helpers/matchBotHelper');
const { getSession, getTransactions } = require('utilities/requests/blocktradesRequests');
const { redisSetter, redis, redisGetter } = require('utilities/redis');
const notificationsRequest = require('utilities/requests/notificationsRequest');
const { MIN_DEBT_TO_SUSPENDED } = require('constants/appData');
const { checkOnHoldStatus } = require('utilities/helpers/campaignsHelper');

const startExpiredListener = () => {
  redis.subscribeCampaignExpired(subscribeCampaignsEx);
  redis.subscribeDemoPostsExpired(subscribeDemoPostsEx);
};

const subscribeCampaignsEx = async (chan, msg) => {
  const data = msg.split('_');
  switch (data[0]) {
    case 'expire:campaign':
      await expireCampaign(msg);
      break;
    case 'expire:assign':
      await expireAssinged(msg);
      break;
  }
};

const subscribeDemoPostsEx = async (chan, msg) => {
  const data = msg.split('|');
  const id = data[1];
  const author = data[1];
  const permlink = data[2];
  switch (data[0]) {
    case 'expire:demopost':
      await expireDemoPost({ author, permlink });
      break;
    case 'expire:matchBotVote':
      await expireMatchBotRecount({
        author, permlink, voter: data[3], percent: data[4],
      });
      break;
    case 'expire:claimRewardJob':
      if (process.env.NODE_ENV === 'production') {
        await expirePowerDown();
      }
      break;
    case 'expire:paymentDebt':
      await expireDebtStatus(id);
      break;
    case 'expire:withdrawTransaction':
      await expireWithdrawTransaction(id);
      break;
    case 'expire:suspendedWarning':
      const reservationPermlink = data[1];
      const days = data[2];
      await suspendedWarning(reservationPermlink, days);
      break;
    case 'expire:recalculationDebt':
      await recalculateDebt(author, permlink);
      break;
    case 'expire:withdrawRequest':
      await expireWithdrawRequest(id);
      break;
    case 'expire:pendingTransfer':
      await expirePendingTransfer(id);
      break;
  }
};

const expirePendingTransfer = async (id) => {
  const { result } = await paymentHistoryModel.findOne({ _id: id });
  if (_.get(result, 'details.transactionId')) {
    await paymentHistoryModel.deleteMany({ _id: id });
  }
};

const expireAssinged = async (data) => {
  const assignPermlink = data.replace('expire:', '');
  let assignData;
  const notParsingParams = await redis.campaigns.getAsync(assignPermlink);

  try {
    assignData = JSON.parse(notParsingParams);
  } catch (error) {
    console.log(error.message);
  }
  if (!assignData) return null;
  const result = await Campaign.updateOne({
    activation_permlink: assignData.campaign_permlink,
    users: {
      $elemMatch: {
        name: assignData.user_name,
        status: 'assigned',
        permlink: assignData.assign_permlink,
      },
    },
  },
  { $set: { 'users.$.status': 'expired' } });

  if (result.n) {
    await UserWobjects.create({
      user_name: assignData.user_name,
      author_permlink: assignData.approved_object,
      weight: -1,
    });
    redis.campaigns.del(assignPermlink);
    console.log(`User: ${assignData.user_name} assign expired in campaign permlink: ${assignData.campaign_permlink}`);
    await checkOnHoldStatus(assignData.campaign_permlink);
  }
};

const expireCampaign = async (data) => {
  const _id = data.replace('expire:campaign_', '');
  const result = await Campaign.updateOne({ _id, status: { $in: ['active', 'reachedLimit'] } }, { status: 'expired' });

  if (result.nModified) console.log(`Campaign expired: ${_id}`);
  else console.log(`Campaign not expired: ${_id}`);
};

const expireWithdrawTransaction = async (_id) => {
  await withdrawFundsModel.updateOne({ _id, status: 'pending' }, { status: 'expired' });
};

const expireWithdrawRequest = async (_id) => {
  const { result } = await withdrawFundsModel.findOne({ _id });
  if (!result) return;
  const { result: session } = await getSession({ email: process.env.BLOCKTRADES_EMAIL, password: process.env.BLOCKTRADES_PASSWORD });
  if (!session) return redisSetter.saveTTL(`expire:withdrawRequest|${_id}`, 15);

  const { result: transactions } = await getTransactions(session.token);
  if (!transactions) return redisSetter.saveTTL(`expire:withdrawRequest|${_id}`, 15);

  const transaction = _.find(transactions, (doc) => doc.outputAddress.toLowerCase() === result.address.toLowerCase());
  if (transaction) {
    return withdrawFundsModel.updateOne({ _id },
      {
        transactionId: transaction.transactionId,
        transactionHash: transaction.outputTransactionHash,
        usdValue: +transaction.inputUsdEquivalent,
        outputAmount: +transaction.outputAmount,
      });
  }
  return redisSetter.saveTTL(`expire:withdrawRequest|${_id}`, 15);
};

const suspendedWarning = async (permlink, days) => {
  const payments = await PaymentHistory.find({ 'details.reservation_permlink': permlink }).lean();
  const status = _.every(payments, { payed: true });
  if (!status) {
    const review = _.find(payments, (payment) => payment.type === 'review');
    if (!review) return;
    const { result: campaign } = await campaignModel.findOne({ guideName: review.sponsor, status: 'suspended' });
    if (!campaign) {
      const debtsStatuses = [];
      for (const payment of _.filter(payments, { payed: false })) {
        const { paymentsAmount, debtsAmount } = await getPaymentsAmounts(
          payment.sponsor, payment.userName, payment.createdAt,
        );
        debtsStatuses.push(debtsAmount - paymentsAmount < MIN_DEBT_TO_SUSPENDED);
      }
      if (!_.every(debtsStatuses)) {
        await notificationsRequest.custom('suspendedStatus', {
          sponsor: review.sponsor,
          reviewAuthor: review.userName,
          reviewPermlink: review.details.review_permlink,
          days,
        });
      }
    }
    if (+days !== 1) {
      await redisSetter.saveTTL(`expire:suspendedWarning|${permlink}|1`, 345600);
    }
  }
};

const expirePowerDown = async () => {
  const account = await steemHelper.getAccountInfo(process.env.POWER_ACC_NAME);
  const avail = _.round(parseFloat(account.vesting_shares) - parseFloat(account.delegated_vesting_shares), 6) - 0.000001;
  const { props } = await steemHelper.getCurrentPriceInfo();
  const vestHive = parseFloat(props.total_vesting_fund_steem) * (avail / parseFloat(props.total_vesting_shares));
  if (vestHive <= 0) return redisSetter.saveTTL('expire:claimRewardJob', 605400, 'data');
  const op = [
    'withdraw_vesting',
    {
      account: account.name,
      vesting_shares: `${avail} VESTS`,
    },
  ];
  await steemHelper.sendOperations(op, process.env.POWER_ACC_KEY);
  return redisSetter.saveTTL('expire:claimRewardJob', 605400, 'data');
};

/**
 * Check for exist payout from review, if it exist create record with type demo post in DB
 * @param author {string}
 * @param permlink {string}
 * @returns {Promise<void>}
 */
const expireDemoPost = async ({ author, permlink }) => {
  const post = await steemHelper.getPostInfo({ author, permlink });
  const metadata = JSON.parse(post.json_metadata);
  const steemAmount = await steemHelper.getPostAuthorReward(
    { reward_price: parseFloat(post.total_payout_value) + parseFloat(post.curator_payout_value) },
  );
  if (steemAmount > 0 && _.find(post.beneficiaries, { account: process.env.POWER_ACC_NAME })) {
    let reward = steemAmount / 2;
    if (_.get(post, 'beneficiaries', []).length) {
      const hPower = _.find(post.beneficiaries, (bnf) => bnf.account === process.env.POWER_ACC_NAME);
      if (hPower) reward = (steemAmount / 2) * (hPower.weight / 10000);
      else reward = (steemAmount / 2) * (1 - (_.sumBy(post.beneficiaries, 'weight') / 10000));
    }
    const payment = await PaymentHistory.findOne({
      userName: metadata.comment.userId, sponsor: author, type: 'demo_post', 'details.post_permlink': permlink,
    });
    if (payment) return;
    await PaymentHistory.create({
      userName: metadata.comment.userId,
      sponsor: author,
      type: 'demo_post',
      is_demo_account: true,
      details: {
        post_permlink: permlink,
        title: post.title,
        post_parent_author: post.parent_author,
        post_parent_permlink: post.parent_permlink,
      },
      amount: reward,
    });
  }
};

const expireDebtStatus = async (id) => {
  const payment = await PaymentHistory.findOne({ _id: id, payed: false }).lean();
  if (!payment) return;
  const { debtsAmount, paymentsAmount } = await getPaymentsAmounts(
    payment.sponsor, payment.userName, payment.createdAt,
  );
  if (debtsAmount - paymentsAmount < MIN_DEBT_TO_SUSPENDED) return;
  await Campaign.updateMany({ guideName: payment.sponsor }, { status: 'suspended' });
};

const getPaymentsAmounts = async (sponsor, userName, createdAt) => {
  const allPayments = await PaymentHistory.find({
    sponsor, userName, createdAt: { $lte: createdAt }, payed: false,
  });
  const debtsAmount = _.sumBy(allPayments, (pmnt) => {
    if (_.includes(
      ['review', 'campaign_server_fee', 'referral_server_fee', 'beneficiary_fee', 'index_fee', 'demo_debt'], pmnt.type,
    )) {
      return pmnt.amount;
    }
  }) || 0;
  const paymentsAmount = _.sumBy(allPayments, (pmnt) => {
    if (_.includes(
      ['transfer'], pmnt.type,
    )) {
      return _.get(pmnt, 'details.remaining', 0);
    }
  }) || 0;
  return { debtsAmount, paymentsAmount };
};

const expireMatchBotRecount = async ({ author, permlink, voter }) => {
  const { weight, voteValue: voteWeight, metadata } = await steemHelper.getVoteValue(
    { author, permlink, voter },
  );
  const guestAuthor = checkForGuest('', metadata);
  const campaign = await Campaign.findOne(
    { payments: { $elemMatch: { userName: guestAuthor || author, postPermlink: permlink } } },
  ).lean();
  if (!campaign) return;

  const { result: botUpvote } = await botUpvoteModel.findOne({ botName: voter, author, permlink });
  if (!botUpvote) {
    if (voteWeight <= 0) return;
    const { result } = await redisGetter.getTTLData(`expire:recalculationDebt|${author}|${permlink}`);
    if (!result) {
      const post = await steemHelper.getPostInfo({ author, permlink });
      if (post.author) {
        const timer = Math.round(new Date(post.cashout_time).valueOf() / 1000) - Math.round(new Date().valueOf() / 1000) + 11200;
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
    await matchBotHelper.updateUpvotedRecord({
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
        && Math.trunc(record.completedAt.valueOf() / 10000) === Math.trunc(payment.createdAt.valueOf() / 10000));
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
    await matchBotHelper.updateCompensationFee(bot, campaign, _.round(voteWeight / 2, 3));
  }
};

const recalculateDebt = async (author, permlink) => {
  const post = await steemHelper.getPostInfo({ author, permlink });
  if (!post.author) return;
  author = checkForGuest(author, post.json_metadata);
  const { result: campaign } = await campaignModel.findOne(
    { payments: { $elemMatch: { status: 'active', userName: author, postPermlink: permlink } } },
  );
  if (!campaign) return;

  if (parseFloat(post.total_payout_value) + parseFloat(post.curator_payout_value) === 0) return removeVoteDebt(author, permlink, campaign);
  let botUpvotes = 0, elseUpvotes = 0, downvotes = 0;
  for (const vote of post.active_votes) {
    if (+vote.rshares < 0) {
      downvotes += +vote.rshares;
      continue;
    } if (_.includes([...campaign.match_bots, campaign.guideName], vote.voter)) {
      botUpvotes += +vote.rshares;
    } else {
      elseUpvotes += +vote.rshares;
    }
  }
  if (downvotes >= (botUpvotes + elseUpvotes)) return removeVoteDebt(author, permlink, campaign);
  if (downvotes && botUpvotes < (botUpvotes + elseUpvotes) - downvotes) {
    const { currentPrice } = await steemHelper.getCurrentPriceInfo();
    const payout = _.round(((parseFloat(post.total_payout_value) + parseFloat(post.curator_payout_value)) / 2) / currentPrice, 3);
    await recountVoteDebt({
      payout, author, permlink, campaign,
    });
  }
};

const checkForGuest = (author, metadata) => {
  try {
    metadata = JSON.parse(metadata);
    return _.get(metadata, 'comment.userId', author);
  } catch (e) {
    return author;
  }
};

const recountVoteDebt = async ({
  payout, author, permlink, campaign,
}) => {
  const { histories } = await findHistories({ author, permlink, campaign });
  const voteWeight = _.sumBy(histories, (history) => _.get(history, 'details.votesAmount', 0));
  if (voteWeight === payout) return;

  const compensationFee = _.find(histories, (history) => history.type === 'compensation_fee');
  if (compensationFee) {
    if (compensationFee.payed) {
      const { result: transfer } = await paymentHistoryModel.findOne({
        type: { $in: ['transfer', 'demo_debt'] }, payed: false, sponsor: compensationFee.sponsor, userName: compensationFee.userName,
      });
      let condition = { type: { $in: ['transfer', 'demo_debt'] }, sponsor: compensationFee.sponsor, userName: compensationFee.userName };
      if (transfer) condition = { _id: transfer._id };
      await paymentHistoryModel.updateOne(condition, { payed: false, $inc: { 'details.remaining': compensationFee.amount - payout } });
    }
    await paymentHistoryModel.updateOne({ _id: compensationFee._id }, { amount: payout });
  }

  await matchBotHelper.updatePaymentHistories(
    _.filter(histories, (history) => history.type !== 'compensation_fee'),
    voteWeight > payout ? voteWeight - payout : payout - voteWeight,
    voteWeight > payout ? 'subtract' : 'add',
  );
};

const removeVoteDebt = async (author, permlink, campaign) => {
  campaign = campaign.toObject();
  const { histories } = await findHistories({ author, permlink, campaign });
  for (const history of histories) {
    const votesAmount = history.type === 'compensation_fee'
      ? history.amount
      : _.get(history, 'details.votesAmount', 0);

    if (!votesAmount && history.type !== 'compensation_fee') continue;

    const findCondition = {
      type: { $in: ['transfer', 'demo_debt'] }, payed: false, sponsor: campaign.guideName, userName: history.userName,
    };
    const { result } = await paymentHistoryModel.findOne(findCondition);
    const condition = result ? { _id: result._id } : _.omit(findCondition, ['payed']);

    const remaining = _.get(result, 'details.remaining', 0);
    let newRemaining = _.cloneDeep(remaining);
    const newPayedStatus = history.payed && remaining >= votesAmount;
    if (history.payed !== newPayedStatus) newRemaining += history.amount;

    if (history.type === 'compensation_fee') {
      await paymentHistoryModel.deleteMany({ _id: history._id });
    } else {
      await paymentHistoryModel.updateOne({ _id: history._id }, {
        $inc: { amount: history.details.votesAmount }, 'details.votesAmount': 0, payed: newPayedStatus,
      });
    }

    await paymentHistoryModel.updateOne(condition, {
      payed: result ? votesAmount === remaining : false,
      'details.remaining': votesAmount > remaining ? newRemaining : remaining - votesAmount,
    });
  }
};

const findHistories = async ({ campaign, author, permlink }) => {
  const payment = _.find(campaign.payments, { userName: author, postPermlink: permlink, status: 'active' });
  const user = _.find(campaign.users,
    (record) => record.name === author && record.status === 'completed'
          && Math.trunc(record.completedAt.valueOf() / 10000) === Math.trunc(payment.createdAt.valueOf() / 10000));
  if (!user) return [];
  const { result: histories } = await paymentHistoryModel.find(
    { 'details.reservation_permlink': user.permlink, type: { $in: ['review', 'beneficiary_fee', 'compensation_fee'] } },
  );
  return { histories: histories || [] };
};

module.exports = {
  expireMatchBotRecount, expireDemoPost, startExpiredListener, recalculateDebt,
};
