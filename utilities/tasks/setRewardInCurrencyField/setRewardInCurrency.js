const { Campaign } = require('database').models;
const { SUPPORTED_CURRENCIES } = require('constants/constants');

module.exports = async () => {
  const campaigns = await Campaign.find({}, { reward: 1 }).lean();
  for (const campaign of campaigns) {
    await Campaign.updateOne(
      { _id: campaign._id },
      { $set: { currency: SUPPORTED_CURRENCIES.USD, rewardInCurrency: campaign.reward } },
    );
  }
};
