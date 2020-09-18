const _ = require('lodash');
const { campaignModel, userModel } = require('models');
const campaignHelper = require('utilities/helpers/campaignsHelper');
const { activeCampaignStatuses, CAMPAIGN_STATUSES_FOR_ON_HOLD } = require('constants/constants');

/**
 * Validate campaign before activation
 * @param campaign_id {string}
 * @param guide_name {string}
 * @param permlink {string}
 */
// eslint-disable-next-line camelcase
const validateActivation = async ({ campaign_id, guide_name, permlink }) => {
  const { result: campaign } = await campaignModel.findOne({ _id: campaign_id, status: 'pending', guideName: guide_name });
  const limitDate = new Date();

  limitDate.setDate(limitDate.getDate() + 1);
  if (campaign && permlink) {
    const { result: existCampaign } = await campaignModel.findOne({ activation_permlink: permlink, status: 'active' });

    if (!_.isEmpty(existCampaign)) return { is_valid: false, message: 'Permlink not unique' };

    if (campaign.expired_at < limitDate) return { is_valid: false, message: 'Expiration time is invalid' };
    // ##TODO disable check balance before activation
    // const balance = await isEnoughBalance( campaign.guideName, campaign.budget );

    return { is_valid: true, campaign, balance: 0 };
  }
  return { is_valid: false, message: 'Invalid campaign_id or activation permlink. Campaign status must be pending' };
};

/**
 * Validate can current user reserve current campaign by conditions from campaign
 * @param campaign_permlink {string}
 * @param user_name {string}
 * @param approved_object {string}
 * @param reservation_permlink {string}
 */
const validateAssign = async ({
  // eslint-disable-next-line camelcase
  campaign_permlink, user_name: name, approved_object, reservation_permlink,
}) => {
  const { result: campaign } = await campaignModel.findOne({ activation_permlink: campaign_permlink, status: 'active' });
  const { user: findUser } = await userModel.findOne(name);
  // eslint-disable-next-line max-len
  const todaySpendTime = (new Date().getUTCHours() * 3600 + new Date().getUTCMinutes() * 60 + new Date().getUTCSeconds());

  // eslint-disable-next-line max-len,camelcase
  if (!campaign || !campaign.objects.includes(approved_object) || !findUser || !reservation_permlink) {
    return { is_valid: false, message: 'Invalid campaign activation permlink, reservation permlink or invalid user' };
  }
  const { result: existPermlinkReservation } = await campaignModel.findOne({ 'users.permlink': reservation_permlink });

  if (existPermlinkReservation) return { is_valid: false, message: 'Reservation permlink not unique' };
  if (!campaign.canAssign) return { is_valid: false, message: 'Reserve exceeded by budget' };

  const { lastCompleted } = await campaignHelper.getCompletedUsersInSameCampaigns(
    campaign.guideName, campaign.requiredObject, name,
  );
  const daysPassed = Math.trunc(
    (new Date().valueOf() - new Date(lastCompleted).valueOf()) / 86400000,
  );

  const assignedUser = _.find(campaign.users, (user) => user.name === name && user.status === 'assigned');
  if (assignedUser) return { is_valid: false, message: 'Reservation is exist' };
  const canAssignBySameMainObject = await checkReserveInSameCampaigns({ campaign, userName: name });

  if (campaign.frequency_assign > daysPassed) return { is_valid: false, message: 'Reservation frequency is exeeded' };
  if (!canAssignBySameMainObject) return { is_valid: false, message: 'Reservation in this main object is exist' };

  const limitReservationDays = countReservationDays({
    reservation_timetable: campaign.reservation_timetable,
    count_reservation_days: campaign.count_reservation_days,
  });

  if (limitReservationDays === 0) return { is_valid: false, message: 'Today can not reservation' };
  const reservationTime = (86400 * limitReservationDays) - todaySpendTime;

  return {
    is_valid: true,
    campaign,
    limit_reservation_days: limitReservationDays,
    reservation_time: reservationTime,
  };
};

/**
 * Check for possibility unreserve campaign
 * @param campaign_permlink {string}
 * @param reservation_permlink {string}
 * @param user_name {string}
 * @param unreservation_permlink {string}
 * @returns {Promise<{is_valid: boolean, message: string}|{is_valid: boolean}>}
 */
const validateRejectAssign = async ({
  // eslint-disable-next-line camelcase
  campaign_permlink, reservation_permlink, user_name, unreservation_permlink,
}) => {
  const { result: campaign } = await campaignModel.findOne({
    activation_permlink: campaign_permlink,
    status: { $in: CAMPAIGN_STATUSES_FOR_ON_HOLD },
  });

  // eslint-disable-next-line camelcase
  if (!campaign || !reservation_permlink || !user_name || !unreservation_permlink) {
    return { is_valid: false, message: 'Invalid campaign activation permlink, unreservation permlink, reservation permlink or invalid user' };
  }

  // eslint-disable-next-line camelcase
  const user = _.find(campaign.users, (_user) => _user.name === user_name && _user.status === 'assigned' && _user.permlink === reservation_permlink);

  if (!user) return { is_valid: false, message: 'Reservation not exist' };

  const { result: existPermlinkUnreservation } = await campaignModel.findOne({ 'users.unreservation_permlink': unreservation_permlink });

  if (existPermlinkUnreservation) return { is_valid: false, message: 'Uneservation permlink not unique' };
  return { is_valid: true };
};

/**
 * Validate deactivation campaign
 * @param campaign_permlink {string}
 * @param guide_name {string}
 * @param permlink {string}
 * @returns {Promise<{is_valid: boolean, message: string}|{is_valid: boolean, campaign: *}>}
 */
// eslint-disable-next-line camelcase
const validateInactivation = async ({ campaign_permlink, guide_name, permlink }) => {
  const { result: campaign } = await campaignModel.findOne(
    { activation_permlink: campaign_permlink, guideName: guide_name, status: { $in: activeCampaignStatuses } },
  );

  if (_.isEmpty(permlink)) return { is_valid: false, message: 'Deactivation permlink must be exist' };
  if (_.isEmpty(campaign)) return { is_valid: false, message: 'Campaign not exist' };
  return { is_valid: true, campaign };
};

/**
 *
 * @param reservation_timetable
 * @param count_reservation_days
 * @returns {*}
 */
// eslint-disable-next-line camelcase
const countReservationDays = ({ reservation_timetable, count_reservation_days: countDays }) => {
  let approvedDays = 0;
  const reservationDays = reservation_timetable.toObject();
  const dayKeys = Object.keys(reservationDays);
  const currentDay = new Date().getDay();
  const sortedDays = dayKeys.slice(currentDay - 1, 7).concat(dayKeys.slice(0, currentDay - 1));

  for (const day of sortedDays) {
    if (day === sortedDays[6] && reservationDays[day]) {
      approvedDays = countDays;
      break;
    }
    if (reservationDays[day]) {
      approvedDays += 1;
    } else {
      break;
    }
  }
  return _.min([approvedDays, countDays]);
};

/**
 * Check user from input params for active reservations
 * in same required objects, if it exist return false, esle true
 * @param campaign {Object}
 * @param userName {string}
 * @returns {Promise<boolean>}
 */
const checkReserveInSameCampaigns = async ({ campaign, userName }) => {
  const { result: reservationsCurrentObject } = await campaignModel.aggregate([
    { $unwind: '$users' },
    {
      $match: {
        guideName: campaign.guideName,
        status: 'active',
        requiredObject: campaign.requiredObject,
        'users.name': userName,
        'users.status': 'assigned',
      },
    }]);

  return _.isEmpty(reservationsCurrentObject);
};

module.exports = {
  validateActivation,
  validateAssign,
  validateRejectAssign,
  validateInactivation,
};
