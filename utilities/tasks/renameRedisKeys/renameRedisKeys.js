const redis = require('utilities/redis/redis');
const { campaignModel } = require('models');

module.exports = async () => {
  const records = await redis.campaigns.keysAsync('expire:campaign_*');

  for (const record of records) {
    // eslint-disable-next-line camelcase
    const [prefix, activation_permlink] = record.split('_');
    const { result } = await campaignModel.findOne({ activation_permlink });
    if (!result) continue;
    const id = result._id.toString();
    await redis.campaigns.renameAsync(record, `${prefix}_${id}`);
  }
  console.log('task done');
};
