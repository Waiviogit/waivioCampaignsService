const { campaignModel } = require('models');
const moment = require('moment');

module.exports = async () => {
  const { campaigns } = await campaignModel.find({ status: 'pending' });
  if (!campaigns.length) return;
  const now = moment().valueOf();

  for (const campaign of campaigns) {
    const campaignExpireAt = moment(campaign.expired_at).valueOf();
    if (campaignExpireAt < now) {
      const id = campaign._id.toString();
      await campaignModel.changeStatus(id, 'expired');
    }
  }
  console.log('task done');
};
