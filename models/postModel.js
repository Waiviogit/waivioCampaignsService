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

module.exports = {
  getOne,
};
