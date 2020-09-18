const { Subscriptions } = require('database').models;

exports.getFollowings = async ({ follower }) => {
  try {
    const result = await Subscriptions.find({ follower }).select('following').lean();
    return { users: result.map((el) => el.following) };
  } catch (error) {
    return { error };
  }
};

exports.find = async ({
  condition, skip, limit, sort,
}) => {
  try {
    return {
      subscriptionData: await Subscriptions
        .find(condition)
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .lean(),
    };
  } catch (error) {
    return { error };
  }
};
