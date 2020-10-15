const _ = require('lodash');
const dhive = require('@hiveio/dhive');
const { specialTransferBeneficiaries } = require('constants/constants');

const { Asset } = dhive;
const steemClient = new dhive.Client('https://anyx.io', {
  timeout: 8 * 1000,
  failoverThreshold: 4,
  rebrandedApi: true,
});

const likePost = async ({
  key, voter, author, permlink, weight,
}) => {
  try {
    const result = await steemClient.broadcast.vote({
      voter, author, permlink, weight,
    },
    dhive.PrivateKey.fromString(key));
    console.log(`Successfully liked. Included in block: ${result.block_num}`);
    return { result: true };
  } catch (error) {
    console.error(error.message);
    return { result: false };
  }
};

/**
 *
 * @param from {string}
 * @param to {string}
 * @param amount {number}
 * @param memo {string | undefined}
 * @param activeKey
 * @returns {Promise<{result: boolean}|{error: any}>}
 */
const transfer = async ({
  from, to, amount, memo = '', activeKey,
}) => {
  const key = await dhive.PrivateKey.fromString(activeKey);

  return steemClient.broadcast.transfer({
    from, to, amount: new Asset(amount, 'HIVE'), memo,
  }, key).then(
    (data) => ({ result: true, data }),
    (error) => ({ error }),
  );
};

/**
 *
 * @param names {[string]}
 * @returns {Promise<any>}
 */
const getAccountsInfo = async (names) => steemClient.database.call('get_accounts', [names]);

/**
 *
 * @param name {string}
 * @returns {Promise<null|*>}
 */
const getAccountInfo = async (name) => {
  const accounts = await steemClient.database.call('get_accounts', [[name]]);

  if (!_.isEmpty(accounts)) return accounts[0];
  return null;
};

/**
 *
 * @param author {string}
 * @param permlink {string}
 * @returns {Promise<any>}
 */
const getPostInfo = async ({ author, permlink }) => {
  try {
    const result = await steemClient.database.call('get_content', [author, permlink]);
    return result;
  } catch (error) {
    console.error(error.message);
    return { author: '', permlink: '' };
  }
};

/**
 *
 * @returns {Promise<{currentPrice: number, rewardFund: any}>}
 */
const getCurrentPriceInfo = async () => {
  const sbdMedian = await steemClient.database.call('get_current_median_history_price', []);
  const rewardFund = await steemClient.database.call('get_reward_fund', ['post']);
  const props = await steemClient.database.getDynamicGlobalProperties();
  return {
    currentPrice: parseToFloat(sbdMedian.base) / parseToFloat(sbdMedian.quote),
    rewardFund,
    props,
  };
};

const getPostAuthorReward = async ({ reward_price: rewardPrice }) => {
  const sbdMedian = await steemClient.database.call('get_current_median_history_price', []);

  console.log(`DEMOPOST REWARD: {post_reward:${rewardPrice}, sbd_median: ${sbdMedian.quote}, sdbbase: ${sbdMedian.base}`);
  return parseFloat(rewardPrice) * (parseFloat(sbdMedian.quote) / parseFloat(sbdMedian.base));
};

const getVotingInfo = async (accountName, weight = 100, postAuthor, postPermlink) => {
  const acc = await getAccountInfo(accountName);

  if (acc) {
    const secondsAgo = (new Date().getTime() - new Date(`${acc.last_vote_time}Z`).getTime()) / 1000;
    const accountVotingPower = Math.min(10000, acc.voting_power + (10000 * secondsAgo) / 432000);
    // eslint-disable-next-line max-len
    const { voteValue } = await calculateVotePower(accountName, weight, postAuthor, postPermlink);
    return {
      voteWeight: _.round(voteValue, 3),
      currentVotePower: _.floor(accountVotingPower),
    };
  }
  return { voteWeight: null, currentVotePower: null };
};

/*
Calculate vote value after vote, returns -1 if it is downVote
return 0 if vote weight = 0
 */
const getVoteValue = async (vote) => {
  const post = await getPostInfo({ author: vote.author, permlink: vote.permlink });
  if (!post.author || parseFloat(post.pending_payout_value) === 0 || +post.net_rshares === 0) {
    return { weight: 0, voteValue: 0 };
  }

  const currentVote = _.find(post.active_votes,
    (hiveVote) => vote.voter === hiveVote.voter);
  if (!currentVote || currentVote.percent === 0) return { weight: _.get(currentVote, 'percent', 0), voteValue: 0, metadata: post.json_metadata };
  if (currentVote.percent < 0) {
    return { weight: currentVote.percent, voteValue: -1, metadata: post.json_metadata };
  }

  const voteHDBWeight = +currentVote.rshares
      / (+post.net_rshares / parseFloat(post.pending_payout_value));
  const { currentPrice } = await getCurrentPriceInfo();

  return {
    weight: currentVote.percent,
    voteValue: _.round(voteHDBWeight / currentPrice, 3),
    metadata: post.json_metadata,
  };
};

/*
 It really works!Calculates the vote value in HIVE,
 if you need to calculate the value in HBD, add price in final calculation
*/
const calculateVotePower = async (name, voteWeight, author, permlink) => {
  const account = await getAccountInfo(name);
  const { rewardFund, currentPrice: price } = await getCurrentPriceInfo();
  const vests = parseFloat(account.vesting_shares)
      + parseFloat(account.received_vesting_shares) - parseFloat(account.delegated_vesting_shares);

  const previousVoteTime = (new Date().getTime() - new Date(`${account.last_vote_time}Z`).getTime()) / 1000;
  const accountVotingPower = Math.min(
    10000, account.voting_power + (10000 * previousVoteTime) / 432000,
  );

  const power = (((accountVotingPower / 100) * voteWeight)) / 50;
  const rShares = (vests * power * 100) - 50000000;

  const post = await getPostInfo({ author, permlink });

  const tRShares = parseFloat(post.vote_rshares) + rShares;

  const s = parseFloat(rewardFund.content_constant);
  const tClaims = (tRShares * (tRShares + (2 * s))) / (tRShares + (4 * s));

  const rewards = parseFloat(rewardFund.reward_balance) / parseFloat(rewardFund.recent_claims);
  const postValue = tClaims * rewards; // *price - to calculate in HBD
  const voteValue = postValue * (rShares / tRShares);
  return { voteValue };
};

const parseToFloat = (balance) => parseFloat(balance.match(/.\d*.\d*/)[0]);

const getPostState = async ({ author, permlink, category }) => {
  const result = await steemClient.database.call(
    'get_state',
    [`${category}/@${author}/${permlink}`],
  );
  if (!result || result.error) return { error: { message: _.get(result, 'error') } };

  return { result };
};

const sendOperations = async (operations, key) => {
  try {
    return {
      result: await steemClient.broadcast.sendOperations(
        [operations], dhive.PrivateKey.fromString(key),
      ),
    };
  } catch (error) {
    console.error(error.message);
    return { error };
  }
};

const claimRewards = async (account) => {
  const accountInfo = await getAccountInfo(account.name);
  if (accountInfo.error) return;
  const operation = [
    'claim_reward_balance',
    {
      account: account.name,
      reward_hbd: accountInfo.reward_hbd_balance,
      reward_hive: accountInfo.reward_hive_balance,
      reward_vests: `${accountInfo.reward_vesting_balance.split(' ')[0]} VESTS`,
    },
  ];
  return sendOperations(operation, account.key);
};

const makeSpecialTransfers = async (account) => {
  const accountInfo = await getAccountInfo(account.name);
  const amount = parseFloat(accountInfo.balance) / specialTransferBeneficiaries.length;
  if (!amount) return;
  for (const acc of specialTransferBeneficiaries) {
    await transfer({
      from: account.name, amount: _.floor(amount, 2), to: acc, activeKey: account.key,
    });
  }
};

module.exports = {
  likePost,
  getPostInfo,
  transfer,
  getAccountsInfo,
  getAccountInfo,
  getVotingInfo,
  getPostAuthorReward,
  calculateVotePower,
  getVoteValue,
  getPostState,
  claimRewards,
  makeSpecialTransfers,
  getCurrentPriceInfo,
  sendOperations,
};
