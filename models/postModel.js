const { Post } = require('database').models;

const getOne = async ({ author, permlink }) => Post.findOne({ author, permlink });

module.exports = {
  getOne,
};
