const { RESERVATION_STATUSES, CAMPAIGN_STATUSES } = require('constants/constants');
const { campaignModel } = require('models');

module.exports = async ({ userName }) => {
  const pipeline = [
    {
      $match: {
        status: { $in: [CAMPAIGN_STATUSES.ACTIVE, CAMPAIGN_STATUSES.ON_HOLD] },
        users: { $elemMatch: { name: userName, status: RESERVATION_STATUSES.ASSIGNED } },
      },
    },
    { $count: 'count' },
  ];
  const { result: [{ count = 0 } = {}], error } = await campaignModel.aggregate(pipeline);
  if (error) return { error };

  return { count };
};
