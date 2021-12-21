const { Post } = require('database').models;

const getOne = async ({ author, permlink }) => {
  try {
    return {
      post: await Post
        .findOne({ $or: [{ author, permlink }, { root_author: author, permlink }] }).lean(),
    };
  } catch (error) {
    return { error };
  }
};

const find = async (filter, projection) => {
  try {
    return {
      posts: await Post.find(filter, projection).lean(),
    };
  } catch (error) {
    return { error };
  }
};

module.exports = {
  getOne, find,
};
