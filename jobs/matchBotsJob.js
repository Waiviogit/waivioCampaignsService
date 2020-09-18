const schedule = require('node-schedule');
const MatchBotHelper = require('utilities/helpers/matchBotHelper');
const MatchBotModel = require('models/matchBotModel');

/**
 * Every 30 minutes check for expired upvotes and update debt records if any,
 * and upvote reviews with status pending if any
 */
schedule.scheduleJob('0,30 * * * *', async () => {
  await MatchBotHelper.executeRecount();
  await MatchBotHelper.executeUpvotes();
});

/**
 * Remove sponsors which  permissions expired by time (run once per day at 00.01)
 */
schedule.scheduleJob('1 0 * * *', async () => {
  await MatchBotModel.inactivateRules();
});
