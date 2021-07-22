const { matchBotModel, blacklistModel, userModel } = require('models');
const matchBotHelper = require('utilities/helpers/matchBotHelper');
const jsonHelper = require('utilities/helpers/jsonHelper');
const moment = require('moment');
const _ = require('lodash');

/**
 * match_bot_set_rule => check conditions =>
 * add add sponsor to bot in database or create bot if it not exist
 * match_bot_remove_rule => remove sponsor from match bot
 * match_bot_change_power => change match bot voting power
 * waivio_set_app_commisson => set app commissions for campaigns
 * @param data
 * @returns {Promise<void>}
 */
const parse = async (data) => {
  const json = jsonHelper.parseJson(data.json);

  const authorizedUser = data.required_posting_auths ? data.required_posting_auths[0] : null;
  switch (data.id) {
    case 'match_bot_set_rule':
      const expired = moment(json.expiredAt).utc().toDate();
      const tomorrow = moment().utc().add(1, 'days').startOf('day')
        .toDate();
      if (json.sponsor && (!json.expiredAt || expired >= tomorrow)) {
        await matchBotHelper.setRule({
          bot_name: authorizedUser,
          sponsor: json.sponsor,
          voting_percent: json.voting_percent,
          note: json.note,
          enabled: json.enabled,
          expiredAt: json.expiredAt ? moment(json.expiredAt).utc().startOf('day').toDate() : null,
        });
      }
      break;
    case 'match_bot_remove_rule':
      if (json.sponsor) {
        await matchBotModel.removeRule({ bot_name: authorizedUser, sponsor: json.sponsor });
      }
      break;
    case 'match_bot_change_power':
      if (json.voting_power) {
        await matchBotModel.setVotingPower(
          { bot_name: authorizedUser, voting_power: json.voting_power },
        );
      }
      break;
    case 'addUsersToWhiteList':
      if (json.names) {
        await blacklistModel.updateOne({ user: authorizedUser }, {
          $addToSet: { whiteList: { $each: json.names } },
        });
      }
      break;
    case 'removeUsersFromBlackList':
    case 'removeUsersFromWhiteList':
      if (json.names) {
        await blacklistModel.updateOne({ user: authorizedUser },
          { $pull: { [data.id === 'removeUsersFromWhiteList' ? 'whiteList' : 'blackList']: { $in: json.names } } });
      }
      break;
    case 'addUsersToBlackList':
      if (json.names) {
        await blacklistModel.updateOne({ user: authorizedUser }, {
          $addToSet: { blackList: { $each: json.names } },
          $pull: { whiteList: { $in: json.names } },
        });
      }
      break;
    case 'unFollowAnotherBlacklist':
    case 'followAnotherBlacklist':
      if (json.names) {
        const { users } = await userModel.findByNames(json.names);
        if (!users || !users.length) return;
        const names = _.map(users, 'name');

        const updateData = data.id === 'followAnotherBlacklist'
          ? { $addToSet: { followLists: { $each: names } } }
          : { $pull: { followLists: { $in: names } } };

        await blacklistModel.updateOne({ user: authorizedUser }, updateData);
      }
      break;
  }
};

module.exports = { parse };
