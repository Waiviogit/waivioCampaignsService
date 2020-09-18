const { paymentHistoryModel } = require('models');
const { Post } = require('database').models;
const _ = require('lodash');

const addDetails = async () => {
  const { result, error } = await paymentHistoryModel.find({ type: 'demo_post' });
  if (error) return console.error(error);
  const postPermlinks = _.map(result, 'details.post_permlink');
  const posts = await Post.find({ permlink: { $in: postPermlinks } }).lean();
  if (!posts) return console.error('posts not found');

  for (const element of result) {
    const post = _.find(posts, (el) => (
      el.author === element.userName && el.permlink === element.details.post_permlink
    ));
    if (post) {
      const data = {
        'details.title': post.title,
        'details.post_parent_author': post.parent_author,
        'details.post_parent_permlink': post.parent_permlink,
      };
      const { result: update, error: dbError } = await paymentHistoryModel
        .updateOne({ _id: element._id }, { $set: data });
      console.log(update, element.userName);
      if (dbError) console.error(dbError);
    }
  }
};

module.exports = { addDetails };
