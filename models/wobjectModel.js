const { CAMPAIGN_STATUSES } = require('constants/constants');
const { Wobject } = require('database').models;
const _ = require('lodash');

exports.aggregate = async (pipeline) => {
  try {
    return { result: await Wobject.aggregate(pipeline) };
  } catch (error) {
    return { error };
  }
};

exports.findOne = async (condition, select = {}) => {
  try {
    return { result: await Wobject.findOne(condition, select).lean() };
  } catch (error) {
    return { error };
  }
};

exports.find = async (condition) => {
  try {
    return { result: await Wobject.find(condition).lean() };
  } catch (error) {
    return { error };
  }
};

exports.updateCampaignsCount = async ({ wobjPermlinks = [], status, id }) => {
  try {
    const updateData = status === CAMPAIGN_STATUSES.ACTIVE
      ? { $addToSet: { activeCampaigns: id } }
      : { $pull: { activeCampaigns: id } };

    await Wobject.updateMany(
      { author_permlink: { $in: wobjPermlinks } },
      updateData,
    ).lean();

    const wobjects = await Wobject.find(
      { author_permlink: { $in: wobjPermlinks } },
      { activeCampaigns: 1 },
    ).lean();

    for (const wobject of wobjects) {
      await Wobject.updateOne(
        { _id: wobject._id },
        { activeCampaignsCount: _.get(wobject, 'activeCampaigns.length', 0) },
      );
    }
    return { result: true };
  } catch (error) {
    return { error };
  }
};
