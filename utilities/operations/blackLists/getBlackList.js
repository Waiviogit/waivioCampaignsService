const _ = require('lodash');
const { blacklistModel, userModel } = require('models');

module.exports = async (guideName) => {
  const { blackLists: [blackList] } = await blacklistModel.find({ user: guideName });
  if (!blackList) return { error: { status: 404, message: 'blackList not found' } };
  const userNames = [blackList.user, ...blackList.followLists, ...blackList.whiteList, ...blackList.blackList];
  const { users } = await userModel.findByNames(userNames);
  const guide = _.find(users, (user) => user.name === blackList.user);
  blackList.user = _.pick(guide, ['name', 'json_metadata', 'wobjects_weight']);
  blackList.blackList = _.compact(_.map(blackList.blackList, (name) => {
    const currentUser = _.find(users, (user) => user.name === name);
    if (currentUser) return _.pick(currentUser, ['name', 'json_metadata', 'wobjects_weight']);
  }));
  blackList.whiteList = _.compact(_.map(blackList.whiteList, (name) => {
    const currentUser = _.find(users, (user) => user.name === name);
    if (currentUser) return _.pick(currentUser, ['name', 'json_metadata', 'wobjects_weight']);
  }));
  blackList.followLists = _.compact(_.map(blackList.followLists, (name) => {
    const currentUser = _.find(users, (user) => user.name === name);
    if (currentUser) return _.pick(currentUser, ['name', 'json_metadata', 'wobjects_weight']);
  }));
  return { blackList };
};
