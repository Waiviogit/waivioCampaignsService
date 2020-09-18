const { userModel } = require('models');

module.exports = async ({
  skip, limit, count_follows: countFollows, count_posts: countPosts,
}) => {
  const { result: users, error } = await userModel.aggregate(
    usersByFilter(countFollows, countPosts, [], skip, limit),
  );
  if (error) return { error };
  return { users };
};

const usersByFilter = (minFollowsRequire, minPostsRequire, whitelist, skip, limit) => [
  {
    $project: {
      users_follow: { $cond: { if: { $isArray: '$users_follow' }, then: { $size: '$users_follow' }, else: 0 } },
      count_posts: 1,
      name: 1,
    },
  },
  {
    $match: {
      users_follow: { $gte: minFollowsRequire },
      count_posts: { $gte: minPostsRequire },
    },
  },
  { $project: { _id: 0, name: 1 } },
  { $skip: parseInt(skip, 10) },
  { $limit: parseInt(limit, 10) },
];
