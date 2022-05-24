const _ = require('lodash');
const { redisSetter } = require('utilities/redis');
const currencyRequest = require('utilities/requests/currencyRequest.js');
const { campaignModel, reservationCurrencyModel } = require('models');
const preValidationHelper = require('utilities/helpers/preValidationHelper.js');
const { CAMPAIGN_STATUSES_FOR_ON_HOLD } = require('constants/constants');
const { checkOnHoldStatus } = require('utilities/helpers/campaignsHelper');
/**
 * Validate assign and get reservation time,
 * if assign valid => create records in redis and update campaign assigned users info
 * @param data {Object}
 * @returns {Promise<{result: boolean}>}
 */
exports.assign = async (data) => {
  let result;
  const {
    is_valid: isValid,
    reservation_time: time,
  } = await preValidationHelper.validateAssign(data);

  if (isValid) {
    try {
      const { result: dbCurrency } = await reservationCurrencyModel.findOne(
        { _id: data.currencyId },
      );
      const { usdCurrency } = await currencyRequest.getHiveCurrency();
      ({ result } = await campaignModel.updateOne(
        { activation_permlink: data.campaign_permlink, status: 'active' },
        {
          $push: {
            users: {
              name: data.user_name,
              rootName: data.root_name,
              status: 'assigned',
              hiveCurrency: _.get(dbCurrency, 'hiveCurrency', usdCurrency),
              object_permlink: data.approved_object,
              permlink: data.reservation_permlink,
              referral_server: data.referral_account,
            },
          },
        },
      ));
      await redisSetter.setExpireAssign(
        data.campaign_permlink, data.reservation_permlink,
        data.approved_object, data.user_name, time,
      );
      if (result) {
        await reservationCurrencyModel.deleteOne({ _id: data.currencyId });
        return { result: true };
      }
    } catch (error) {
      return { result: false };
    }
  }
  await redisSetter.publishAssignFalse(data.reservation_permlink);
  return { result: false };
};

exports.reject = async (data) => {
  let result;
  const { is_valid: isValid } = await preValidationHelper.validateRejectAssign(data);

  if (isValid) {
    ({ result } = await campaignModel.updateOne(
      {
        activation_permlink: data.campaign_permlink,
        status: { $in: CAMPAIGN_STATUSES_FOR_ON_HOLD },
        users: {
          $elemMatch: {
            name: data.user_name,
            status: 'assigned',
            permlink: data.reservation_permlink,
          },
        },
      },
      { $set: { 'users.$.status': 'unassigned', 'users.$.unreservation_permlink': data.unreservation_permlink } },
    ));
    if (result) {
      await redisSetter.removeExpirationAssign(data.reservation_permlink);
      await checkOnHoldStatus(data.campaign_permlink);
      return { result: true };
    }
  }
  return { result: false };
};
