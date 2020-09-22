const _ = require('lodash');
const moment = require('moment');
const { MatchBot } = require('database').models;

/**
 * Create or update match bot if it exists
 * @param data {Object}
 * @returns {Promise<boolean>}
 */
const setMatchBot = async (data) => {
  const findMatchBot = await MatchBot.findOne({ bot_name: data.bot_name, 'sponsors.sponsor_name': data.sponsor });

  if (findMatchBot) return updateMatchBot(data);
  return createMatchBot(data);
};

/**
 * Create match bot
 * @param bot_name {string}
 * @param sponsor {string}
 * @param voting_percent {number} (min 1, max 10000, default 8000)
 * @param enabled {boolean}
 * @param note {string | undefined}
 * @param expiredAt {Date}
 * @returns {Promise<boolean>}
 */
const createMatchBot = async ({
  // eslint-disable-next-line camelcase
  bot_name, sponsor, voting_percent, enabled, note, expiredAt,
}) => {
  try {
    const result = await MatchBot.updateOne(
      { bot_name },
      {
        $push: {
          sponsors: {
            sponsor_name: sponsor, voting_percent, enabled, note, expiredAt,
          },
        },
      },
      { upsert: true, setDefaultsOnInsert: true, runValidators: true },
    );

    return !!result;
  } catch (error) {
    return false;
  }
};

// eslint-disable-next-line camelcase
const removeRule = async ({ bot_name, sponsor }) => {
  try {
    const result = await MatchBot.updateOne(
      { bot_name },
      { $pull: { sponsors: { sponsor_name: sponsor } } },
    );

    return !!result.n;
  } catch (error) {
    return false;
  }
};

/**
 * Update sponsors info for match bot
 * @param bot_name {string}
 * @param sponsor {string}
 * @param enabled {boolean}
 * @param voting_percent {number}
 * @param note {string | undefined} max length 256 symbol
 * @param expiredAt {Date}
 * @returns {Promise<boolean>}
 */
const updateMatchBot = async ({
  // eslint-disable-next-line camelcase
  bot_name, sponsor, enabled, voting_percent, note, expiredAt,
}) => {
  if (enabled) {
    const matchBot = await MatchBot.findOne({ bot_name }).lean();

    const findSponsor = _.find(matchBot.sponsors, (record) => record.sponsor_name === sponsor);

    if (findSponsor.expiredAt && findSponsor.expiredAt < moment().utc().toDate()) return false;
  }
  try {
    const result = await MatchBot.updateOne(
      { bot_name, 'sponsors.sponsor_name': sponsor },
      {
        $set: {
          'sponsors.$': _.omitBy({
            sponsor_name: sponsor,
            enabled,
            voting_percent,
            note,
            expiredAt,
          }, _.isNil),
        },
      },
      { runValidators: true, setDefaultsOnInsert: true },
    );

    return !!result;
  } catch (error) {
    return false;
  }
};

/**
 * Mapped allowed sponsors for match bot
 * @param bot_name {string}
 * @param skip {number | undefined}
 * @param limit {number | undefined}
 * @returns {Promise<{votingPower: (*|string|{default: number, min: number, max: number,
 * type: Number | NumberConstructor, required: boolean}|null), results: (*|Array|*[])}>}
 */
// eslint-disable-next-line camelcase
const getMatchBots = async ({ bot_name, skip, limit }) => {
  const matchBot = await MatchBot.findOne({ bot_name }, { sponsors: { $slice: [skip, limit] } });
  const mappedData = matchBot && _.map(matchBot.sponsors, (sponsor) => (
    {
      bot_name: matchBot.bot_name,
      min_voting_power: matchBot.min_voting_power,
      sponsor: sponsor.sponsor_name,
      note: sponsor.note,
      enabled: sponsor.enabled,
      voting_percent: sponsor.voting_percent,
      expiredAt: sponsor.expiredAt,
    }));

  // eslint-disable-next-line no-mixed-operators
  return { results: mappedData || [], votingPower: matchBot && matchBot.min_voting_power || null };
};

/**
 * Update min voting power for allow vote
 * @param bot_name {string | null }
 * @param voting_power {number} (min 1, max 10000, default 8000)
 * @returns {Promise<boolean>}
 */
// eslint-disable-next-line camelcase
const setVotingPower = async ({ bot_name, voting_power }) => {
  try {
    const result = await MatchBot.updateOne(
      { bot_name }, { min_voting_power: voting_power }, { runValidators: true },
    );

    return !!result.n;
  } catch (error) {
    return false;
  }
};

/**
 * Disable or enable match bot for all sponsors
 * @param bot_name {string}
 * @param enabled {boolean}
 * @returns {Promise<boolean>}
 */
// eslint-disable-next-line camelcase
const updateStatus = async ({ bot_name, enabled }) => {
  const result = await MatchBot.updateOne({ bot_name }, { 'sponsors.$[].enabled': enabled }, { runValidators: true });

  return !!result.n;
};

/**
 * update match bot status for each sponsor depending on whether the resolution has completed
 * @returns {Promise<void>}
 */
const inactivateRules = async () => {
  await MatchBot.updateMany({ 'sponsors.expiredAt': { $lte: moment().utc().startOf('day') } }, { 'sponsors.$.enabled': false });
};

const findOne = async (condition) => {
  try {
    return { result: await MatchBot.findOne(condition) };
  } catch (error) {
    return { error };
  }
};

const find = async (condition) => {
  try {
    return { result: await MatchBot.find(condition) };
  } catch (error) {
    return { error };
  }
};

module.exports = {
  inactivateRules,
  updateStatus,
  setVotingPower,
  removeRule,
  setMatchBot,
  getMatchBots,
  findOne,
  find,
};
