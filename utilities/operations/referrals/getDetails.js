const _ = require('lodash');
const { REFERRAL_TYPES, SUSPENDED_DAYS } = require('constants/constants');
const { appModel } = require('models');

module.exports = async (appName) => {
  const { error, result } = await appModel.findOne(appName);
  if (error || !result) return { error: error || { status: 404, message: 'App not found!' } };
  const campaignPercent = _.get(result, 'app_commissions.campaigns_percent', 0.3);
  const rewardsReferral = _.find(result.referralsData || [],
    { type: REFERRAL_TYPES.REVIEWS });

  const indexServerPercent = _.round((1 - campaignPercent)
      * _.get(result, 'app_commissions.index_percent', 0.2) * 100, 5);

  const referralServerPercent = _.round((100 - (campaignPercent * 100)
      - indexServerPercent), 5);

  return {
    result: {
      referralDuration: _.get(rewardsReferral, 'duration', 90),
      campaignServerPercent: campaignPercent * 100,
      indexServerPercent,
      referralServerPercent,
      suspendedTimer: SUSPENDED_DAYS,
    },
  };
};
