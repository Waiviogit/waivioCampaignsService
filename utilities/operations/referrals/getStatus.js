const _ = require('lodash');
const moment = require('moment');
const { SORT_TYPES, REFERRAL_TYPES } = require('constants/constants');
const { userModel } = require('models');

const sortUsers = (sort, users) => {
  switch (sort) {
    case SORT_TYPES.RECENCY:
      return _.orderBy(users, ['started'], ['desc']);
    case SORT_TYPES.EXPIRY:
      return _.orderBy(users, ['ended'], ['asc']);
  }
};

module.exports = async ({
  limit, skip, userName, sort,
}) => {
  /** In this case we dont filter by date adn type because we have not indexes */
  const { users, error } = await userModel.find(
    { referral: { $elemMatch: { agent: userName, type: REFERRAL_TYPES.REWARDS } } },
  );
  if (error) return { error };
  if (!users.length) return { users: [], hasMore: false };

  let activeUsers = _.map(users, (user) => {
    const referralData = _.find(user.referral, { agent: userName, type: REFERRAL_TYPES.REWARDS });
    if (referralData.endedAt > new Date()) {
      return {
        alias: user.alias,
        name: user.name,
        started: referralData.startedAt,
        ended: referralData.endedAt,
        daysLeft: moment.utc(referralData.endedAt).get('dayOfYear') - moment.utc().get('dayOfYear'),
      };
    }
  });
  activeUsers = sortUsers(sort, _.compact(activeUsers));

  return {
    users: activeUsers.slice(skip, skip + limit),
    hasMore: activeUsers.slice(skip, limit + skip + 1).length > limit,
  };
};
