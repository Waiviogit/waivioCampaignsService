const { redisSetter, redisGetter } = require('utilities/redis');
const crypto = require('node:crypto');
const { getPostInfo } = require('../../hiveApi/hiveOperations');
const { voteExtendedMatchBots } = require('../../helpers/matchBotHelper');

// need to add our validation time?
const SUPPOSED_DELAY_SEC = 9 + 3;
const LAST_MOMENT_VOTE_KEY = 'lastMomentVote';

const getsSecondsToCashout = async (author, permlink) => {
  const post = await getPostInfo({ author, permlink });
  if (post.error) return 0;
  // eslint-disable-next-line camelcase
  const { cashout_time, created } = post;

  let cashoutDate;
  // eslint-disable-next-line camelcase
  if (cashout_time) {
    cashoutDate = new Date(cashout_time);
  } else {
    // Fallback: created + 7 days
    cashoutDate = new Date(created);
    cashoutDate.setDate(cashoutDate.getDate() + 7);
  }

  const now = new Date();
  const ttlMs = cashoutDate.getTime() - now.getTime();
  const ttlSeconds = Math.floor(ttlMs / 1000);

  return ttlSeconds > 0 ? ttlSeconds : 0;
};
const setExpireLastMomentVote = async (voteData) => {
  const { author, permlink } = voteData;
  const secondsToCashout = await getsSecondsToCashout(author, permlink);
  if (!secondsToCashout) return;
  const ttl = secondsToCashout - SUPPOSED_DELAY_SEC;
  if (ttl <= (1)) return;
  const id = crypto.randomUUID();
  await redisSetter.setSimpleTtl(`expire:${LAST_MOMENT_VOTE_KEY}|${id}`, ttl);
  await redisSetter.saveTTL(`${LAST_MOMENT_VOTE_KEY}:${id}`, ttl, JSON.stringify(voteData));
};

const lastMomentVote = async (id) => {
  const { result } = await redisGetter.getTTLData(`${LAST_MOMENT_VOTE_KEY}:${id}`);
  if (!result) return;
  await voteExtendedMatchBots(result);
};

module.exports = {
  setExpireLastMomentVote,
  lastMomentVote,
  LAST_MOMENT_VOTE_KEY,
};
