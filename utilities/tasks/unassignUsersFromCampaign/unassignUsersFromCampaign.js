const { Campaign } = require('database').models;
const moment = require('moment');
const _ = require('lodash');

module.exports = async () => {
  const select = {
    count_reservation_days: 1,
    users: 1,
  };

  const campaigns = await Campaign.find().select(select).lean();
  const now = moment().valueOf();

  for (const campaign of campaigns) {
    const usersLength = _.get(campaign, 'users.length', 0);

    if (!usersLength) continue;
    await Promise.all(campaign.users.map(async (user) => {
      const expiredTime = moment(user.createdAt).add(campaign.count_reservation_days, 'd').valueOf();

      if (expiredTime < now && user.status === 'assigned') {
        await Campaign.updateOne({
          _id: campaign._id,
          users: {
            $elemMatch: {
              name: user.name,
              status: 'assigned',
              permlink: user.permlink,
            },
          },
        },
        { $set: { 'users.$.status': 'unassigned' } });
      }
    }));
  }
  console.log('task completed');
};
