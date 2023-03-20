const { SponsorsUpvoteSchema } = require('database').models;

const findOne = async ({ filter, projection, options }) => {
  try {
    const result = await SponsorsUpvoteSchema.findOne(filter, projection, options).lean();
    return { result };
  } catch (error) {
    return { error };
  }
};

const getCampaignUpvote = async ({ voter, author, permlink }) => {
  const { result, error } = await findOne({
    filter: { botName: voter, author, permlink },
    projection: { _id: 1 },
  });
  if (error) return;
  return result;
};

module.exports = {
  getCampaignUpvote,
};
