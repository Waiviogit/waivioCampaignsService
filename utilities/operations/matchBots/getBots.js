const { extendedMatchBotModel } = require('models');
const _ = require('lodash');

exports.getBotByType = async ({
  botName, type, skip, limit,
}) => {
  const { result, error } = await extendedMatchBotModel.findOne(
    { botName, type },
    { accounts: { $slice: [skip, limit + 1] } },
  );
  if (error) return { error };
  if (_.isEmpty(_.get(result, 'accounts'))) return { bots: [] };

  return {
    result: _.take(result.accounts, limit),
    hasMore: result.accounts?.length > limit,
  };
};
