const _ = require('lodash');
const { campaignModel } = require('models');
const { CAMPAIGN_STATUSES, RESERVATION_STATUSES } = require('constants/constants');

module.exports = async () => {
  const { campaigns } = await campaignModel.find({ status: CAMPAIGN_STATUSES.ON_HOLD });
  for (const campaign of campaigns) {
    const hasAssignedUsers = _
      .filter(campaign.users, (u) => u.status === RESERVATION_STATUSES.ASSIGNED);
    if (_.isEmpty(hasAssignedUsers)) {
      await campaignModel.updateOne({ _id: campaign._id }, { status: CAMPAIGN_STATUSES.INACTIVE });
    }
  }
  console.log('task done');
};
