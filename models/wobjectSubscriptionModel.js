const { WobjectSubscriptions } = require('database').models;

exports.getFollowers = async ({ following }) => {
  try {
    const result = await WobjectSubscriptions.find({ following }).select('follower')
      .lean();
    return { wobjFollowers: result.map((el) => el.follower) };
  } catch (error) {
    return { error };
  }
};

exports.getFollowings = async ({ follower }) => {
  try {
    const result = await WobjectSubscriptions.find({ follower }).select('following')
      .lean();
    return { wobjects: result.map((el) => el.following) };
  } catch (error) {
    return { error };
  }
};
