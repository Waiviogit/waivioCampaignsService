const { matchBotHelper } = require('utilities/helpers');

/**
 * check for disabled permissions for upvote with bot account by
 * our service, if bot auth array dont includes our account name, disable mach bot
 * @param data
 * @returns {Promise<void>}
 */
const parse = async (data) => {
  if (data.posting && data.posting.account_auths) {
    await matchBotHelper.checkDisable(
      { bot_name: data.account, account_auths: data.posting.account_auths },
    );
  }
};

module.exports = { parse };
