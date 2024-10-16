const { matchBotModel, blacklistModel, userModel } = require('models');
const matchBotHelper = require('utilities/helpers/matchBotHelper');
const { CUSTOM_JSON_TYPES } = require('constants/parsersData');
const jsonHelper = require('utilities/helpers/jsonHelper');
const moment = require('moment');
const _ = require('lodash');
const { processCuratorsGuestMatchBot } = require('../utilities/operations/matchBots/curatorsBot');

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
    case CUSTOM_JSON_TYPES.MATCH_BOT_SET_RULE:
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
    case CUSTOM_JSON_TYPES.MATCH_BOT_REMOVE_RULE:
      if (json.sponsor) {
        await matchBotModel.removeRule({ bot_name: authorizedUser, sponsor: json.sponsor });
      }
      break;
    case CUSTOM_JSON_TYPES.MATCH_BOT_CHANGE_POWER:
      if (json.voting_power) {
        await matchBotModel.setVotingPower(
          { bot_name: authorizedUser, voting_power: json.voting_power },
        );
      }
      break;
    case CUSTOM_JSON_TYPES.MATCH_BOT_SET:
      await matchBotHelper.setBot({ botName: authorizedUser, json });
      break;
    case CUSTOM_JSON_TYPES.MATCH_BOT_UNSET:
      await matchBotHelper.unsetBot({ botName: authorizedUser, json });
      break;
    case CUSTOM_JSON_TYPES.ADD_USERS_TO_WHITE_LIST:
      if (json.names) {
        await blacklistModel.updateOne({ user: authorizedUser }, {
          $addToSet: { whiteList: { $each: json.names } },
        });
      }
      break;
    case CUSTOM_JSON_TYPES.REMOVE_USERS_FROM_BLACK_LIST:
    case CUSTOM_JSON_TYPES.REMOVE_USERS_FROM_WHITE_LIST:
      if (json.names) {
        await blacklistModel.updateOne(
          { user: authorizedUser },
          { $pull: { [data.id === 'removeUsersFromWhiteList' ? 'whiteList' : 'blackList']: { $in: json.names } } },
        );
      }
      break;
    case CUSTOM_JSON_TYPES.ADD_USERS_TO_BLACK_LIST:
      if (json.names) {
        await blacklistModel.updateOne({ user: authorizedUser }, {
          $addToSet: { blackList: { $each: json.names } },
          $pull: { whiteList: { $in: json.names } },
        });
      }
      break;
    case CUSTOM_JSON_TYPES.UNFOLLOW_ANOTHER_BLACK_LIST:
    case CUSTOM_JSON_TYPES.FOLLOW_ANOTHER_BLACK_LIST:
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
    case CUSTOM_JSON_TYPES.WAIVIO_GUEST_VOTE:
      await processCuratorsGuestMatchBot({ operation: data, vote: json });
      break;
  }
};

module.exports = { parse };
