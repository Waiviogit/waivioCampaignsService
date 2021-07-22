const _ = require('lodash');
const { PrivateKey, Asset } = require('@hiveio/dhive');
const { specialTransferBeneficiaries } = require('constants/constants');
const { postModel } = require('models');

exports.likePost = async (client, {
  key, voter, author, permlink, weight,
}) => {
  try {
    const result = await client.broadcast.vote({
      voter, author, permlink, weight,
    },
    PrivateKey.fromString(key));
    console.log(`Successfully liked. Included in block: ${result.block_num}`);
    return { result: true };
  } catch (error) {
    return { error };
  }
};

/**
 * @param client {object}
 * @param from {string}
 * @param to {string}
 * @param amount {number}
 * @param memo {string | undefined}
 * @param activeKey
 * @returns {Promise<{result: boolean}|{error: any}>}
 */
exports.transfer = async (client, {
  from, to, amount, memo = '', activeKey,
}) => {
  try {
    const data = await client.broadcast.transfer({
      from, to, amount: new Asset(amount, 'HIVE'), memo,
    }, PrivateKey.fromString(activeKey));
    return { result: true, data };
  } catch (error) {
    return { error };
  }
};

/**
 * @param client {object}
 * @param names {[string]}
 * @returns {Promise<any>}
 */
exports.getAccountsInfo = async (client, names) => {
  try {
    return client.database.call('get_accounts', [names]);
  } catch (error) {
    return { error };
  }
};

/**
 * @param client {object}
 * @param name {string}
 * @returns {Promise<null|*>}
 */
exports.getAccountInfo = async (client, name) => {
  try {
    const accounts = await client.database.call('get_accounts', [[name]]);

    if (!_.isEmpty(accounts)) return accounts[0];
    return null;
  } catch (error) {
    return { error };
  }
};

/**
 * @param client {object}
 * @param author {string}
 * @param permlink {string}
 * @returns {Promise<any>}
 */
exports.getPostInfo = async (client, { author, permlink }) => {
  try {
    return client.database.call('get_content', [author, permlink]);
  } catch (error) {
    return { error };
  }
};

/**
 * @param client {object}
 * @returns {Promise<{currentPrice: number, rewardFund: any}|{error: any}>}
 */
exports.getCurrentPriceInfo = async (client) => {
  try {
    const sbdMedian = await client.database.call('get_current_median_history_price', []);
    const rewardFund = await client.database.call('get_reward_fund', ['post']);
    const props = await client.database.getDynamicGlobalProperties();
    return {
      currentPrice: parseToFloat(sbdMedian.base) / parseToFloat(sbdMedian.quote),
      rewardFund,
      props,
    };
  } catch (error) {
    return { error };
  }
};

exports.getPostAuthorReward = async (client, { reward_price: rewardPrice }) => {
  try {
    const sbdMedian = await client.database.call('get_current_median_history_price', []);

    return parseFloat(rewardPrice) * (parseFloat(sbdMedian.quote) / parseFloat(sbdMedian.base));
  } catch (error) {
    return { error };
  }
};

exports.getPostState = async (client, { author, permlink, category }) => {
  try {
    return {
      result: await client.database.call(
        'get_state',
        [`${category}/@${author}/${permlink}`],
      ),
    };
  } catch (error) {
    return { error };
  }
};

exports.sendOperations = async (client, { operations, key }) => {
  try {
    return {
      result: await client.broadcast.sendOperations(
        [operations], PrivateKey.fromString(key),
      ),
    };
  } catch (error) {
    return { error };
  }
};

/*
Calculate vote value after vote, returns -1 if it is downVote
return 0 if vote weight = 0
 */
exports.getVoteValue = async (client, vote) => {
  const post = await this.getPostInfo(client, { author: vote.author, permlink: vote.permlink });
  if (!post.author || parseFloat(post.pending_payout_value) === 0 || +post.net_rshares === 0) {
    return { weight: 0, voteValue: 0 };
  }

  const currentVote = _.find(post.active_votes,
    (hiveVote) => vote.voter === hiveVote.voter);
  if (!currentVote || currentVote.percent === 0) {
    return {
      weight: _.get(currentVote, 'percent', 0),
      voteValue: 0,
      metadata: post.json_metadata,
    };
  }
  if (currentVote.percent < 0) {
    return { weight: currentVote.percent, voteValue: -1, metadata: post.json_metadata };
  }

  const voteHDBWeight = +currentVote.rshares
    / (+post.net_rshares / parseFloat(post.pending_payout_value));
  const { currentPrice } = await this.getCurrentPriceInfo(client);

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
exports.calculateVotePower = async (client, {
  name, voteWeight, author, permlink,
}) => {
  const account = await this.getAccountInfo(client, name);
  const { rewardFund, currentPrice: price } = await this.getCurrentPriceInfo(client);
  const vests = parseFloat(account.vesting_shares)
    + parseFloat(account.received_vesting_shares) - parseFloat(account.delegated_vesting_shares);

  const previousVoteTime = (new Date().getTime() - new Date(`${account.last_vote_time}Z`).getTime()) / 1000;
  const accountVotingPower = Math.min(
    10000, account.voting_power + (10000 * previousVoteTime) / 432000,
  );

  const power = (((accountVotingPower / 100) * voteWeight)) / 50;
  const rShares = (vests * power * 100) - 50000000;

  const postVoteRhares = await getPostVoteRhares(client, { author, permlink });

  const tRShares = postVoteRhares + rShares;

  const s = parseFloat(rewardFund.content_constant);
  const tClaims = (tRShares * (tRShares + (2 * s))) / (tRShares + (4 * s));

  const rewards = parseFloat(rewardFund.reward_balance) / parseFloat(rewardFund.recent_claims);
  const postValue = tClaims * rewards; // *price - to calculate in HBD
  const voteValue = postValue * (rShares / tRShares);
  return { voteValue, voteValueHBD: voteValue * price, votePower: accountVotingPower };
};

exports.getVotingInfo = async (client, {
  accountName, weight = 100, postAuthor, postPermlink,
}) => {
  const acc = await this.getAccountInfo(client, accountName);

  if (acc) {
    const secondsAgo = (new Date().getTime() - new Date(`${acc.last_vote_time}Z`).getTime()) / 1000;
    const accountVotingPower = Math.min(10000, acc.voting_power + (10000 * secondsAgo) / 432000);
    // eslint-disable-next-line max-len
    const { voteValue } = await this.calculateVotePower(client, {
      name: accountName,
      voteWeight: weight,
      author: postAuthor,
      permlink: postPermlink,
    });
    return {
      voteWeight: _.round(voteValue, 3),
      currentVotePower: _.floor(accountVotingPower),
    };
  }
  return { voteWeight: null, currentVotePower: null };
};

exports.claimRewards = async (client, account) => {
  const accountInfo = await this.getAccountInfo(client, account.name);
  if (accountInfo.error) return;
  const operations = [
    'claim_reward_balance',
    {
      account: account.name,
      reward_hbd: accountInfo.reward_hbd_balance,
      reward_hive: accountInfo.reward_hive_balance,
      reward_vests: `${accountInfo.reward_vesting_balance.split(' ')[0]} VESTS`,
    },
  ];
  return this.sendOperations(client, { operations, key: account.key });
};

exports.makeSpecialTransfers = async (client, account) => {
  const accountInfo = await this.getAccountInfo(client, account.name);
  const amount = parseFloat(accountInfo.balance) / specialTransferBeneficiaries.length;
  if (!amount) return;
  for (const acc of specialTransferBeneficiaries) {
    await this.transfer(client, {
      from: account.name, amount: _.floor(amount, 2), to: acc, activeKey: account.key,
    });
  }
};

const parseToFloat = (balance) => parseFloat(balance.match(/.\d*.\d*/)[0]);

const getPostVoteRhares = async (client, { author, permlink }) => {
  let { post } = await postModel.getOne({ author, permlink });
  if (!post) {
    post = await this.getPostInfo(client, { author, permlink });
  }
  return _.get(post, 'vote_rshares')
    ? parseFloat(post.vote_rshares)
    : 0;
};
