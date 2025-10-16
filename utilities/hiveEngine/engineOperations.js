const currencyRequest = require('utilities/requests/currencyRequest');
const axios = require('axios');
const _ = require('lodash');

const commentContract = require('./commentContract');
const tokensContract = require('./tokensContract');
const marketPools = require('./marketPools');
const {
  MAX_VOTING_POWER, VOTE_REGENERATION_DAYS, DOWNVOTE_REGENERATION_DAYS,
} = require('../../constants/hiveEngine');

// 'https://accounts.hive-engine.com/accountHistory'
exports.accountHistory = async (params) => {
  try {
    return await axios.get('https://history.hive-engine.com/accountHistory', { params });
  } catch (error) {
    return error;
  }
};

exports.calculateMana = (votingPower) => {
  const timestamp = new Date().getTime();
  const result = {
    votingPower: votingPower.votingPower,
    downvotingPower: votingPower.downvotingPower,
    lastVoteTimestamp: votingPower.lastVoteTimestamp,
  };

  result.votingPower += ((timestamp - result.lastVoteTimestamp) * MAX_VOTING_POWER)
      / (VOTE_REGENERATION_DAYS * 24 * 3600 * 1000);
  result.votingPower = Math.floor(result.votingPower);
  result.votingPower = Math.min(result.votingPower, MAX_VOTING_POWER);

  result.downvotingPower += ((timestamp - result.lastVoteTimestamp) * MAX_VOTING_POWER)
      / (DOWNVOTE_REGENERATION_DAYS * 24 * 3600 * 1000);
  result.downvotingPower = Math.floor(result.downvotingPower);
  result.downvotingPower = Math.min(result.downvotingPower, MAX_VOTING_POWER);
  return result;
};

exports.calculateVotePower = async ({
  symbol, account, poolId, weight, dieselPoolId,
}) => {
  const requests = await Promise.all([
    tokensContract.getTokenBalances({ query: { symbol, account } }),
    commentContract.getVotingPower({ query: { rewardPoolId: poolId, account } }),
    marketPools.getMarketPools({ query: { _id: dieselPoolId } }),
    commentContract.getRewardPools({ query: { _id: poolId } }),
    currencyRequest.getHiveCurrency(),
  ]);

  for (const req of requests) {
    if (_.has(req, 'error') || _.isEmpty(req)) {
      console.log(`[ENGINE OPERATIONS] ${account} failed calculateVotePower ${_.has(req, 'error') ? req?.error?.message : ''}`);
      return {
        engineVoteValueHBD: 0,
        engineVotePower: 0,
      };
    }
  }
  const [balances, votingPowers, dieselPools, smtPool, hiveCurrency] = requests;
  const { stake, delegationsIn } = balances[0];
  const { votingPower, downvotingPower } = this.calculateMana(votingPowers[0]);
  const { quotePrice } = dieselPools[0];
  const { rewardPool, pendingClaims } = smtPool[0];

  const finalRshares = parseFloat(stake) + parseFloat(delegationsIn);
  const power = (votingPower * weight) / 10000;

  const rshares = (power * finalRshares) / 10000;
  // we calculate price in hbd cent for usd multiply quotePrice hiveCurrency.usdCurrency
  const hbd = hiveCurrency.usdCurrency * hiveCurrency.hbdToDollar;
  const price = parseFloat(quotePrice) * hbd;
  const rewards = parseFloat(rewardPool) / parseFloat(pendingClaims);

  const engineVoteValueHBD = rshares * price * rewards;
  return { engineVoteValueHBD, engineVotePower: votingPower, engineDownvotePower: downvotingPower };
};
