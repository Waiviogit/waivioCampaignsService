const { CampaignFactory } = require('test/factories');

exports.campaignsForPayments = async (objects) => {
  await CampaignFactory.Create({
    status: 'active',
    users: [{
      status: 'unassigned', name: 'user1', object_permlink: objects[0], permlink: 'permlink', hiveCurrency: 1,
    }],
    objects,
    permlink: 'permlink5',
  });
  await CampaignFactory.Create({
    status: 'active',
    users: [{
      status: 'completed', name: 'user1', object_permlink: objects[0], permlink: 'permlink', hiveCurrency: 1,
    }],
    objects,
    permlink: 'permlink6',
  });
  await CampaignFactory.Create({
    status: 'inactive',
    users: [{
      status: 'completed', name: 'user1', object_permlink: objects[0], permlink: 'permlink', hiveCurrency: 1,
    }],
    objects,
    permlink: 'permlink7',
  });
  await CampaignFactory.Create({
    status: 'payed',
    users: [{
      status: 'completed', name: 'user1', object_permlink: objects[0], permlink: 'permlink', hiveCurrency: 1,
    }],
    objects,
    permlink: 'permlink8',
  });
};
