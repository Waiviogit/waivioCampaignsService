const mongoose = require('mongoose');
const moment = require('moment');
const { Campaign } = require('database').models;
const { maxCampaignsAssign } = require('constants/constants');

exports.destroyCampaign = async (campaignId) => Campaign.findOneAndDelete({ _id: mongoose.Types.ObjectId(campaignId), status: 'pending' });

exports.changeStatus = async (campaignId, status) => {
  try {
    const campaign = await Campaign.findOne({ _id: mongoose.Types.ObjectId(campaignId) });

    if (!campaign) return { error: { message: 'Campaign not found' } };

    campaign.set({ status });
    return await campaign.save();
  } catch (error) {
    return { error };
  }
};

exports.canCreateMoreCampaigns = async (userName) => maxCampaignsAssign >= await Campaign.find({ guideName: userName, status: 'active' }).countDocuments();

exports.updateUserStatus = async ({
  // eslint-disable-next-line camelcase
  campaign_id, user_id, status, fraud = false,
}) => {
  await Campaign.updateOne({ _id: campaign_id, users: { $elemMatch: { _id: user_id } } },
    { $set: { 'users.$.status': status, 'users.$.completedAt': moment.utc().format(), 'users.$.fraudSuspicion': fraud } });
};

exports.aggregate = async (pipeline) => {
  try {
    return { result: await Campaign.aggregate(pipeline) };
  } catch (error) {
    return { error };
  }
};

exports.findSponsors = async (matchData) => {
  try {
    return { sponsors: await Campaign.find(matchData).distinct('guideName') };
  } catch (error) {
    return { error };
  }
};

exports.find = async (matchData, sort) => {
  try {
    return { campaigns: await Campaign.find(matchData).sort(sort).lean() };
  } catch (error) {
    return { error };
  }
};

exports.getCounts = async (matchData) => {
  try {
    return { campaigns: await Campaign.find(matchData).countDocuments() };
  } catch (error) {
    return { error };
  }
};

exports.findOne = async (condition) => {
  try {
    return { result: await Campaign.findOne(condition) };
  } catch (error) {
    return { error };
  }
};

exports.getCampaignId = (id) => {
  try {
    return { result: mongoose.Types.ObjectId(id) };
  } catch (error) {
    return { error };
  }
};

exports.updateOne = async (condition, updateData, options) => {
  try {
    return { result: await Campaign.findOneAndUpdate(condition, updateData, options) };
  } catch (error) {
    return { error };
  }
};

exports.updateMany = async (condition, updateData) => {
  try {
    return { result: await Campaign.updateMany(condition, updateData) };
  } catch (error) {
    return { error };
  }
};

exports.create = async (data) => {
  const campaign = new Campaign(data);
  try {
    return { campaign: await campaign.save() };
  } catch (error) {
    return { error };
  }
};
