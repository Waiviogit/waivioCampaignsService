const { blacklistModel } = require('models');
const _ = require('lodash');

exports.getGuideBlackList = async (name) => {
  let result = [];
  const { blackList } = await blacklistModel.findOne({ user: name });
  if (!blackList) return { result: [] };
  result = _.concat(result, blackList.blackList);

  for (const follow of blackList.followLists) {
    _.concat(result, follow.blackList);
    const { blackLists } = await blacklistModel.find(
      { name: { $in: follow.followLists } },
    );
    result = _.concat(result, _.map(blackLists, 'blackList'), follow.blackList);
  }

  return { result: _.uniq(_.flattenDeep(result)), whiteList: blackList.whiteList };
};
