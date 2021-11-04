const currencyRequest = require('utilities/requests/currencyRequest');
const { TOKEN_WAIV } = require('constants/hiveEngine');
const _ = require('lodash');
const commentContract = require('./commentContract');
const tokensContract = require('./tokensContract');
const marketPools = require('./marketPools');

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
      return {
        engineVoteValueHBD: 0,
        engineVotePower: 0,
      };
    }
  }
  const [balances, votingPowers, dieselPools, smtPool, hiveCurrency] = requests;
  const { stake, delegationsIn } = balances[0];
  const { votingPower } = votingPowers[0];
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
  return { engineVoteValueHBD, engineVotePower: votingPower };
};
