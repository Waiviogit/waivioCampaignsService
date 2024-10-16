/* eslint-disable camelcase */
const {
  extendedMatchBotModel,
  paymentHistoryModel,
  botUpvoteModel,
  matchBotModel,
  campaignModel,
  postModel,
  sponsorsUpvoteModel,
} = require('models');
const { hiveOperations } = require('utilities/hiveApi');
const {
  MATCH_BOT_TYPES, BOT_ENV_KEY, MANA_CHECK_TYPES, BOTS_QUEUE, GREY_LIST_KEY,
} = require('constants/matchBotsData');
const { voteCoefficients, SUPPORTED_CRYPTO_CURRENCIES } = require('constants/constants');
const jsonHelper = require('utilities/helpers/jsonHelper');
const validators = require('controllers/validators');
const moment = require('moment');
const _ = require('lodash');
const engineOperations = require('utilities/hiveEngine/engineOperations');
const { TOKEN_WAIV } = require('constants/hiveEngine');
const redisSetter = require('utilities/redis/redisSetter');
const redisGetter = require('utilities/redis/redisGetter');

/**
 * Find all expired match bot upvotes and recount sponsors debt to the contractors
 * @returns {Promise<void>}
 */
const executeRecount = async () => {
  const upvotes = await botUpvoteModel.getExpiredUpvotes();

  for (const upvote of upvotes) {
    const { active_votes: activeVotes } = await hiveOperations.getPostInfo(
      { author: upvote.author, permlink: upvote.permlink },
    );

    const matchBotUpvote = _.find(activeVotes, (vote) => vote.voter === upvote.botName);
    let voteWeight = 0;

    if (matchBotUpvote) voteWeight = upvote.currentVote;

    await updateAmount(upvote, _.round(voteWeight / 2, 3));
    await botUpvoteModel.update({ _id: upvote._id }, { executed: true });
  }
};

const updateAmount = async (paymentData, voteWeight) => {
  let payed = false;
  const { result } = await paymentHistoryModel.find({
    'details.review_permlink': paymentData.permlink,
    'details.reservation_permlink': paymentData.reservationPermlink,
    type: { $in: ['review', 'beneficiary_fee'] },
  });
  if (!result || !result.length) return false;

  const { result: campaign } = await campaignModel.findOne(
    { users: { $elemMatch: { permlink: paymentData.reservationPermlink } } },
  );
  if (_.get(campaign, 'compensationAccount')) {
    await updateCompensationFee(paymentData, campaign, _.round(voteWeight / 2, 3));
  }
  const amount = _.sumBy(result, 'amount');
  if (voteWeight >= amount) {
    voteWeight = amount;
    payed = true;
  }
  return updatePaymentHistories(result, voteWeight, 'add', payed);
};

/**
 * Get all pending matchBot upvotes, if it already upvoted
 * change status to upvoted, else if current vote power > min vote power -
 * try to like post - if catch error - return error
 * @returns {Promise<void>}
 */
const executeUpvotes = async () => {
  const upvotes = await botUpvoteModel.getUpvotes();

  for (const upvote of upvotes) {
    let weight = 1;
    let { currentVotePower, voteWeight } = await hiveOperations.getVotingInfo(
      {
        accountName: upvote.bot_name,
        weight: 100,
        postAuthor: upvote.author,
        postPermlink: upvote.permlink,
      },
    );
    const { post } = await postModel.getOne({ author: upvote.author, permlink: upvote.permlink });

    if (post && post.active_votes && _.map(post.active_votes, 'voter').includes(upvote.bot_name)) {
      return;
    }
    if (currentVotePower >= upvote.min_voting_power) {
      try {
        ({ votePower: weight, voteWeight } = await getNeededVoteWeight(voteWeight, upvote));
        const { result: vote } = await hiveOperations.likePost(
          {
            voter: upvote.bot_name,
            author: upvote.author,
            permlink: upvote.permlink,
            weight,
            key: process.env.UPVOTE_BOT_KEY,
          },
        );
        if (vote) {
          await updateDataAfterVote({ upvote, voteWeight, weight });
        }
      } catch (error) {
        console.log(`Error with match bot upvote: ${error}`);
      }
    }
  }
};

const getNeededVoteWeight = async (totalAmount, upvote) => {
  let needVotePower, iteration = 0;
  let idealCoef = upvote.amountToVote / totalAmount;
  if (idealCoef >= 1) return { votePower: 10000, voteWeight: totalAmount };
  const minAmount = (upvote.amountToVote - upvote.amountToVote * 0.005);
  const maxAmount = (upvote.amountToVote + upvote.amountToVote * 0.005);
  while ((totalAmount > maxAmount || totalAmount < minAmount) && iteration !== 7) {
    idealCoef = _.round(upvote.amountToVote / totalAmount, 3);
    const realFault = idealCoef > 1 ? idealCoef : voteCoefficients[_.round(upvote.amountToVote / totalAmount, 1) * 100];
    const realVote = totalAmount * idealCoef * realFault;
    if (!needVotePower) needVotePower = idealCoef + (((totalAmount * idealCoef) - realVote) / totalAmount);
    else needVotePower *= idealCoef > 1 ? idealCoef : (idealCoef * realFault);
    ({ voteWeight: totalAmount } = await hiveOperations.getVotingInfo(
      {
        accountName: upvote.bot_name,
        weight: _.round(needVotePower, 3) * 100,
        postAuthor: upvote.author,
        postPermlink: upvote.permlink,
      },
    ));
    iteration++;
  }
  const votePower = Math.trunc(_.round(needVotePower, 4) * 10000);
  return { votePower: votePower > 0 ? votePower : 1, voteWeight: totalAmount };
};

const updateCompensationFee = async (upvote, campaign, voteAmount) => {
  const condition = {
    type: 'compensation_fee',
    sponsor: upvote.sponsor,
    userName: campaign.compensationAccount,
    'details.reservation_permlink': upvote.reservationPermlink,
  };
  const reservation = _.find(
    campaign.users,
    (user) => user.permlink === upvote.reservationPermlink,
  );
  const { result } = await paymentHistoryModel.findOne(condition);

  if (voteAmount + _.get(result, 'amount', 0) > campaign.reward / reservation.hiveCurrency) {
    voteAmount = (campaign.reward / reservation.hiveCurrency) - _.get(result, 'amount', 0);
  }
  const { result: transfer } = await paymentHistoryModel.findOne({
    type: { $in: ['transfer', 'demo_debt'] },
    userName: campaign.compensationAccount,
    sponsor: upvote.sponsor,
    payed: false,
  });
  if (_.get(transfer, 'details.remaining', 0) >= voteAmount) {
    await paymentHistoryModel.updateOne(
      { _id: transfer._id },
      { payed: transfer.details.remaining === voteAmount, 'details.remaining': transfer.details.remaining - voteAmount },
    );
  }

  if (result) {
    return paymentHistoryModel.updateOne(
      condition,
      { $inc: { amount: voteAmount }, payed: _.get(transfer, 'details.remaining', 0) >= voteAmount },
    );
  }

  return paymentHistoryModel.addPaymentHistory({
    payed: _.get(transfer, 'details.remaining', 0) >= voteAmount,
    type: 'compensation_fee',
    sponsor: upvote.sponsor,
    payable: voteAmount,
    userName: campaign.compensationAccount,
    hiveCurrency: reservation.hiveCurrency,
    object_permlink: reservation.object_permlink,
    review_permlink: upvote.permlink,
    requiredObject: campaign.requiredObject,
    matchBot: upvote.botName,
    userReservationPermlink: upvote.reservationPermlink,
  });
};

const updateDataAfterVote = async ({ upvote, voteWeight, weight }) => {
  await botUpvoteModel.updateStatus({
    id: upvote._id, status: 'upvoted', currentVote: _.round(voteWeight, 3), votePercent: weight,
  });
  await botUpvoteModel.update(
    { author: upvote.author, permlink: upvote.permlink },
    { $inc: { totalVotesWeight: _.round(voteWeight, 3) } },
  );
};

/**
 * Check for accounts exists, then check for the existence
 * of permissions to perform actions on behalf of the bot by the sponsor,
 * then set match bot with enable or disable flag
 * @param bot_name {string}
 * @param sponsor {string}
 * @param voting_percent {number}
 * @param note {string | undefined}
 * @param enabled {boolean}
 * @param expiredAt {Date}
 * @returns {Promise<{result: boolean}>}
 */
const setRule = async ({
  bot_name, sponsor, voting_percent, note, enabled, expiredAt,
}) => {
  const [botAcc, sponsorAcc] = await hiveOperations.getAccountsInfo(
    [bot_name, sponsor],
  );

  if (!botAcc || !sponsorAcc) return { result: false };

  // eslint-disable-next-line max-len
  enabled = enabled && _.flattenDepth(botAcc.posting.account_auths).includes(process.env.UPVOTE_BOT_NAME);
  return {
    result: await matchBotModel.setMatchBot({
      bot_name, sponsor, voting_percent, note, enabled, expiredAt,
    }),
  };
};

const checkDisable = async ({ bot_name: botName, account_auths: accountAuths }) => {
  if (!isAccountsIncludeBot({ accountAuths, botName: process.env.UPVOTE_BOT_NAME })) {
    const bots = await matchBotModel.getMatchBots({ bot_name: botName, limit: 1 });

    if (!_.isEmpty(bots.results)) {
      await matchBotModel.updateStatus({ bot_name: botName, enabled: false });
    }
  }
  for (const extendedBot of getExtendedBotsArr()) {
    if (isAccountsIncludeBot({ accountAuths, botName: extendedBot })) continue;
    const { result } = await extendedMatchBotModel
      .find({ botName, type: getMatchBotType(extendedBot) });
    if (!_.isEmpty(result)) {
      await extendedMatchBotModel
        .updateStatus({ botName, type: getMatchBotType(extendedBot), enabled: false });
    }
  }
};

const getExtendedBotsArr = () => [process.env.AUTHOR_BOT_NAME, process.env.CURATOR_BOT_NAME];

const isAccountsIncludeBot = ({ botName, accountAuths }) => (
  _.flattenDepth(accountAuths).includes(botName));

const removeVote = async ({ botName, author, permlink }) => {
  const enabled = await checkForEnable(botName);
  if (!enabled) return true;
  await hiveOperations.likePost(
    {
      key: process.env.UPVOTE_BOT_KEY, weight: 0, permlink, author, voter: botName,
    },
  );
  return true;
};

const lookForDownVotes = async (post, bots, voteWeight) => {
  if (parseFloat(post.total_payout_value) === 0) return voteWeight;
  const downVoteRshares = _.sumBy(post.active_votes, (vote) => {
    if (+vote.rshares < 0) return +vote.rshares;
  });
  const allRshares = _.sumBy(post.active_votes, (vote) => +vote.rshares);
  const matchBotsVoteWeight = _.sumBy(post.active_votes, (vote) => {
    if (_.includes(bots, vote.voter)) return +vote.rshares;
  });
  if (!matchBotsVoteWeight) return voteWeight;
  if (!downVoteRshares) return 0;
  const oneHBDRshares = allRshares / (parseFloat(post.total_payout_value) + parseFloat(post.curator_payout_value));

  if ((matchBotsVoteWeight < -downVoteRshares)) {
    if (voteWeight > parseFloat(post.total_payout_value)) {
      return voteWeight - parseFloat(post.total_payout_value);
    }
    if (voteWeight < parseFloat(post.total_payout_value)) return 0;
  }

  return _.round(-downVoteRshares / oneHBDRshares, 4);
};

const checkForEnable = async (botName) => {
  const [botAcc] = await hiveOperations.getAccountsInfo([botName]);
  if (!botAcc) return false;
  return !!_.flattenDepth(botAcc.posting.account_auths).includes(process.env.UPVOTE_BOT_NAME);
};

const removeVotes = async (user, reservationPermlink) => {
  const { result: paymentHistories } = await paymentHistoryModel.find({
    'details.review_permlink': user.postPermlink,
    'details.reservation_permlink': reservationPermlink,
  });
  if (!paymentHistories || !paymentHistories.length) return false;

  const upvotes = await botUpvoteModel.getExpiredUpvotes(user.postPermlink);
  const post = await hiveOperations.getPostInfo(
    { author: user.rootAuthor, permlink: user.postPermlink },
  );
  const reviewHistories = _.filter(paymentHistories, (history) => _.includes(['review', 'beneficiary_fee'], history.type));
  if (upvotes && upvotes.length) {
    if (!post || (post && !post.author)) {
      return updatePaymentHistories(reviewHistories, _.sumBy(upvotes, 'currentVote'), 'subtract', true);
    }

    let removedVotesAmount = 0;
    if (new Date(post.created).valueOf() > moment.utc().subtract(7, 'day').valueOf()) {
      for (const upvote of upvotes) {
        const result = await removeVote(upvote);
        if (!result) continue;
        removedVotesAmount += upvote.currentVote;
      }
    } else {
      removedVotesAmount += await lookForDownVotes(post, _.map(upvotes, 'botName'), _.sumBy(upvotes, 'currentVote'));
    }
    return updatePaymentHistories(reviewHistories, removedVotesAmount, 'subtract');
  }
  return true;
};

const updateUpvotedRecord = async ({ botUpvote, voteWeight }) => {
  let compensationFee, payed;
  let currentVote = voteWeight <= 0 ? -botUpvote.currentVote : voteWeight - botUpvote.currentVote;
  const { result } = await paymentHistoryModel.find({
    'details.reservation_permlink': botUpvote.reservationPermlink,
    type: { $in: ['review', 'beneficiary_fee', 'compensation_fee'] },
  });

  if (result && result.length) {
    compensationFee = _.find(result, (res) => res.type === 'compensation_fee');
    const amount = _.sumBy(result, (history) => {
      if (history.type !== 'compensation_fee') return history.amount;
    });
    if (currentVote > 0 && currentVote >= amount) {
      payed = true;
      currentVote = amount;
    }

    await updatePaymentHistories(_.filter(
      result,
      (res) => res.type !== 'compensation_fee',
    ), _.round(currentVote / 2, 3), 'add', payed);

    if (compensationFee) {
      if (voteWeight <= 0 && compensationFee.amount <= (botUpvote.currentVote) / 2) {
        await paymentHistoryModel.deleteMany({ _id: compensationFee._id });
      } else {
        await paymentHistoryModel.updateOne({ _id: compensationFee._id }, { $inc: { amount: _.round(currentVote / 2, 3) } });
      }
    }
  }
  return botUpvoteModel.update(
    { author: botUpvote.author, permlink: botUpvote.permlink },
    { $inc: { totalVotesWeight: currentVote } },
  );
};

const updatePaymentHistories = async (histories, voteWeight, marker, payed, afterVote = true) => {
  const updateResult = [];
  for (const history of histories) {
    let insidePayed = _.cloneDeep(payed);
    let amount = voteWeight;
    if (history.type === 'review' && _.get(history, 'details.beneficiaries', []).length) {
      amount = _.round(voteWeight * ((10000 - (_.sumBy(history.details.beneficiaries, 'weight'))) / 10000), 4);
    }
    if (history.type === 'review' && !_.get(history, 'details.beneficiaries', []).length) {
      amount = _.round(voteWeight, 4);
    }
    if (history.type === 'beneficiary_fee') {
      const beneficiarie = _.find(
        history.details.beneficiaries,
        (acc) => acc.account === history.userName,
      );
      amount = _.round(voteWeight * (beneficiarie.weight / 10000), 4);
    }
    if (!payed) insidePayed = await checkForPayed({ history, amount, marker: marker === 'add' ? 'subtract' : 'add' });
    updateResult.push(await paymentHistoryModel.updateAmount({
      afterVote,
      payed: insidePayed,
      userName: history.userName,
      sponsor: history.sponsor,
      reservationPermlink: history.details.reservation_permlink,
      type: history.type,
      amount: marker === 'add' ? amount : -amount,
    }));
  }
  return _.every(updateResult, Boolean) && updateResult.length === histories.length;
};

const checkForPayed = async ({ history, amount, marker }) => {
  const findCondition = {
    type: { $in: ['transfer', 'demo_debt'] }, userName: history.userName, sponsor: history.sponsor, payed: false,
  };
  const { result: transfer } = await paymentHistoryModel.findOne(findCondition);
  const cond = transfer ? { _id: transfer._id } : _.omit(findCondition, ['payed']);
  const remaining = _.get(transfer, 'details.remaining', 0);
  switch (marker) {
    case 'add':
      if (history.payed) {
        let newRemaining = _.cloneDeep(remaining);
        const newPayedStatus = remaining >= amount;
        if (!newPayedStatus) newRemaining += history.amount;

        await paymentHistoryModel.updateOne(cond, {
          payed: transfer ? amount === remaining : false,
          'details.remaining': amount > remaining ? newRemaining : remaining - amount,
        });
        return newPayedStatus;
      }
      return false;
    case 'subtract':
      switch (history.payed) {
        case true:
          let condition = {
            type: { $in: ['transfer', 'demo_debt'] },
            userName: history.userName,
            sponsor: history.sponsor,
          };
          if (transfer) condition = { _id: transfer._id };
          await paymentHistoryModel.updateOne(condition, { payed: false, $inc: { 'details.remaining': amount } });
          return true;
        case false:
          if (!transfer) return false;
          if (remaining < history.amount - amount) return false;
          await paymentHistoryModel.updateOne({ _id: transfer._id }, {
            payed: remaining === (history.amount - amount),
            'details.remaining': remaining - (history.amount - amount),
          });
          return true;
      }
      break;
  }
};

const removePaymentHistories = async (operation) => {
  const { result: campaign } = await campaignModel.findOne(
    {
      guideName: operation.guideName,
      users: { $elemMatch: { permlink: operation.parent_permlink } },
    },
  );
  if (!campaign) return;

  const user = _.find(campaign.users, (member) => member.permlink === operation.parent_permlink);
  if (!user) return;

  const users = {
    $elemMatch: {
      name: user.name,
      status: user.status,
      permlink: user.permlink,
    },
  };
  switch (user.status) {
    case 'assigned':
      await campaignModel.updateOne({
        _id: campaign._id,
        users,
      }, {
        $set: {
          'users.$.status': 'rejected',
          'users.$.rejection_permlink': operation.permlink,
        },
      });
      break;
    case 'completed':
      const payment = _.find(
        campaign.payments,
        (member) => member.userName === user.name && member.objectPermlink === user.object_permlink && member.status === 'active',
      );

      const upvoteResult = await removeVotes(payment, user.permlink);
      if (upvoteResult) {
        await checkAndRemoveHistories(operation.parent_permlink);
      }
      await campaignModel.updateOne({
        _id: campaign._id,
        users,
        payments: {
          $elemMatch: {
            userName: user.name,
            objectPermlink: user.object_permlink,
          },
        },
      }, {
        $set: {
          'users.$.status': 'rejected',
          'users.$.rejection_permlink': operation.permlink,
          'payments.$.status': 'rejected',
          'payments.$.rejectionPermlink': operation.permlink,
        },
      });
      break;
  }
};

const checkAndRemoveHistories = async (permlink) => {
  const { result } = await paymentHistoryModel.find({ 'details.reservation_permlink': permlink });
  if (!result || !result.length) return;
  const ids = [];
  for (const history of result) {
    if (_.get(history, 'details.votesAmount', 0) > 0) {
      await paymentHistoryModel.updateOne(
        { _id: history._id },
        { $set: { amount: -history.details.votesAmount, 'details.votesAmount': 0 } },
      );
      continue;
    }
    ids.push(history._id);
  }
  await paymentHistoryModel.deleteMany({ _id: { $in: ids } });
};

const recountMatchBotVotes = async ({ user, reward, amount }) => {
  const { result: upvotes } = await botUpvoteModel.find({ reservationPermlink: user.permlink });
  if (!upvotes || !upvotes.length) return false;

  for (const upvote of upvotes) {
    const newAmountToVote = (upvote.reward - amount * 2) * (upvote.amountToVote / upvote.reward);
    switch (upvote.status) {
      case 'pending':
        if (amount >= (reward / user.hiveCurrency) + user.rewardRaisedBy) {
          await botUpvoteModel.deleteOne(upvote._id);
        } else {
          await botUpvoteModel.update({ _id: upvote._id }, {
            $set: { amountToVote: newAmountToVote },
          });
        }
        break;
      case 'upvoted':
        if (upvote.executed) {
          return recountDebts(user, amount);
        }
        return reVoteOnReview(upvote, newAmountToVote);
    }
  }
};

const reVoteOnReview = async (upvote, newAmountToVote) => {
  let weight;
  let { voteWeight } = await hiveOperations.getVotingInfo(
    {
      accountName: upvote.bot_name,
      weight: 100,
      postAuthor: upvote.author,
      postPermlink: upvote.permlink,
    },
  );
  upvote.bot_name = upvote.botName;
  upvote.amountToVote = newAmountToVote;

  ({ votePower: weight, voteWeight } = await getNeededVoteWeight(voteWeight, upvote));
  try {
    const { result: vote } = await hiveOperations.likePost(
      {
        voter: upvote.bot_name,
        author: upvote.author,
        permlink: upvote.permlink,
        weight,
        key: process.env.UPVOTE_BOT_KEY,
      },
    );
    if (vote) {
      await botUpvoteModel.update(
        { _id: upvote._id },
        { currentVote: voteWeight, votePercent: weight },
      );
      await botUpvoteModel.update(
        { author: upvote.author, permlink: upvote.permlink },
        { $inc: { totalVotesWeight: voteWeight - upvote.currentVote } },
      );
    }
  } catch (e) {
    return false;
  }
};

const recountDebts = async (user, amount) => {
  const { result: payments } = await paymentHistoryModel.find(
    { 'details.reservation_permlink': user.permlink, type: { $in: ['review', 'beneficiary_fee'] } },
  );
  if (payments && payments.length) {
    await updatePaymentHistories(payments, amount, 'add', null, false);
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

const voteExtendedMatchBots = async (voteData) => {
  const { params, validationError } = validators
    .validate(jsonHelper.parseJson(voteData), validators.matchBots.matchBotVoteSchema);
  if (validationError) {
    console.error(validationError);
    return { result: false };
  }
  const {
    voter, author, permlink, voteWeight, minVotingPower,
    minHBD, botKey, voteComments, minVotingPowerCurrencies,
  } = params;

  const validVote = await canVote({
    minVotingPowerCurrencies,
    voteWeight: Math.abs(voteWeight / 100),
    minVotingPower,
    voteComments,
    name: voter,
    permlink,
    minHBD,
    author,
    botKey,
  });
  if (!validVote) return { result: false };

  const { result: vote, error: votingError } = await hiveOperations.likePost(
    {
      key: process.env[botKey],
      weight: voteWeight,
      permlink,
      author,
      voter,
    },
  );
  if (votingError) {
    console.error(votingError.message);
    return { result: false };
  }
  return { result: !!vote };
};

const canVote = async ({
  name, voteWeight, author, permlink, minVotingPower,
  minHBD, voteComments, botKey, minVotingPowerCurrencies,
}) => {
  const { result: sponsorsVote } = await botUpvoteModel.findOne(
    { botName: name, author, permlink },
  );
  if (sponsorsVote) return false;

  const newCampaignsVote = await sponsorsUpvoteModel
    .getCampaignUpvote({ voter: name, author, permlink });
  if (newCampaignsVote) return false;

  if (botKey === BOT_ENV_KEY.CURATOR) {
    const { result: authorsBot } = await extendedMatchBotModel.findOne(
      {
        botName: name,
        'accounts.name': author,
        type: MATCH_BOT_TYPES.AUTHOR,
        enabled: true,
      },
    );
    if (authorsBot) return false;
  }

  const { voteValueHBD, votePower, isPost } = await hiveOperations.calculateVotePower(
    {
      name, voteWeight, author, permlink,
    },
  );
  const { engineVoteValueHBD, engineVotePower } = await engineOperations.calculateVotePower({
    dieselPoolId: TOKEN_WAIV.DIESEL_POOL_ID,
    poolId: TOKEN_WAIV.POOL_ID,
    symbol: TOKEN_WAIV.SYMBOL,
    weight: voteWeight * 100,
    account: name,
  });

  const manaCheck = checkMinVotingPowerCondition({
    minVotingPowerCurrencies, votePower, engineVotePower, minVotingPower,
  });
  if (!manaCheck) return false;
  if (voteValueHBD + engineVoteValueHBD < minHBD) return false;
  if (!isPost && !voteComments) return false;

  const { post } = await postModel.getOne({ author, permlink });
  if (post) {
    const existingVote = _.find(post.active_votes, (v) => v.voter === name);
    if (existingVote) return false;
  }

  return true;
};

const checkMinVotingPowerCondition = ({
  minVotingPowerCurrencies, votePower, engineVotePower, minVotingPower,
}) => {
  const diff = _.difference(MANA_CHECK_TYPES, minVotingPowerCurrencies);
  if (_.isEmpty(diff)) {
    return engineVotePower > minVotingPower && votePower > minVotingPower;
  }
  if (_.includes(diff, SUPPORTED_CRYPTO_CURRENCIES.HIVE)) {
    return engineVotePower > minVotingPower;
  }
  if (_.includes(diff, TOKEN_WAIV.SYMBOL)) {
    return votePower > minVotingPower;
  }
  return false;
};

const setBot = async ({ botName, json }) => {
  const { params, validationError } = validators
    .validate({ botName, ...json }, validators.matchBots.matchBotSetSchema);
  if (validationError) return { result: false };
  const guestAcc = params.name.includes('_');
  const names = [params.botName];
  if (!guestAcc) names.push(params.name);

  const [botAcc, watchAcc] = await hiveOperations.getAccountsInfo(names);

  if (!botAcc || (!watchAcc && !guestAcc)) return { result: false };
  params.enabled = params.enabled
    && _.flattenDepth(botAcc.posting.account_auths).includes(getMatchBotName(params.type));

  return {
    result: await extendedMatchBotModel.setMatchBot(params),
  };
};

const unsetBot = async ({ botName, json }) => {
  const { params, validationError } = validators
    .validate({ botName, ...json }, validators.matchBots.matchBotUnsetSchema);
  if (validationError) return { result: false };

  return {
    result: await extendedMatchBotModel.unsetMatchBot(params),
  };
};

const getMatchBotName = (type) => {
  const botName = {
    [MATCH_BOT_TYPES.AUTHOR]: () => process.env.AUTHOR_BOT_NAME,
    [MATCH_BOT_TYPES.CURATOR]: () => process.env.CURATOR_BOT_NAME,
    default: () => '',
  };
  return (botName[type] || botName.default)();
};

const getMatchBotType = (botName) => {
  const botType = {
    [process.env.AUTHOR_BOT_NAME]: () => MATCH_BOT_TYPES.AUTHOR,
    [process.env.CURATOR_BOT_NAME]: () => MATCH_BOT_TYPES.CURATOR,
    default: () => '',
  };
  return (botType[botName] || botType.default)();
};

const voteEngineCurator = async (vote) => {
  if (_.isEmpty(vote)) return;
  const {
    author, permlink, weight, voter,
  } = vote;
  if (weight < 1) return;
  const key = `${BOTS_QUEUE.ENGINE_CURATOR.VOTED_KEY}:${TOKEN_WAIV.SYMBOL}`;
  const expire = moment().subtract(7, 'days').valueOf();
  const yesterday = moment().subtract(1, 'days').valueOf();
  const now = moment().valueOf();

  await redisSetter.zremrangebyscore({ key, start: -Infinity, end: expire });
  const isInGreyList = !!await redisGetter.sismember({
    key: GREY_LIST_KEY,
    member: author,
  });
  if (isInGreyList) return;

  const { result: votedPosts } = await redisGetter
    .zrevrange({ key, start: 0, end: -1 });

  const alreadyVoted = _.some(_.map(votedPosts, (el) => ({
    author: el.split('/')[0],
    permlink: el.split('/')[1],
  })), (p) => _.isEqual(p, { author, permlink }));
  if (alreadyVoted) return;

  const { percentage, error } = await hiveOperations
    .getVotingManaPercentage(process.env.ENGINE_CURATOR_BOT_NAME);

  if (error) return;
  if (percentage < BOTS_QUEUE.ENGINE_CURATOR.MIN_PERCENTAGE) return;
  const { result: dayBefore } = await redisGetter
    .zrevrangebyscore({ key, max: now, min: yesterday });

  const botWeight = BOTS_QUEUE.ENGINE_CURATOR.DAILY_WEIGHT / dayBefore.length > 10000
    ? 10000
    : Math.ceil(BOTS_QUEUE.ENGINE_CURATOR.DAILY_WEIGHT / dayBefore.length);

  const { result } = await hiveOperations.likePost(
    {
      key: process.env.ENGINE_CURATOR_BOT_KEY,
      voter: process.env.ENGINE_CURATOR_BOT_NAME,
      weight: botWeight,
      permlink,
      author,
    },
  );
  if (result) {
    await redisSetter.zadd(key, [now, `${author}/${permlink}/${voter}`]);
  }
};

module.exports = {
  checkMinVotingPowerCondition,
  checkAndRemoveHistories,
  removePaymentHistories,
  updatePaymentHistories,
  voteExtendedMatchBots,
  updateCompensationFee,
  recountMatchBotVotes,
  updateUpvotedRecord,
  isAccountsIncludeBot,
  getNeededVoteWeight,
  getExtendedBotsArr,
  voteEngineCurator,
  getMatchBotName,
  getMatchBotType,
  executeUpvotes,
  executeRecount,
  checkForGuest,
  checkForPayed,
  checkDisable,
  removeVotes,
  removeVote,
  unsetBot,
  setRule,
  canVote,
  setBot,
};
