const dotenv = require('dotenv');

dotenv.config({ path: `env/${process.env.NODE_ENV || 'development'}.env` });
const specialTransferBeneficiaries = process.env.SPECIAL_BENEFICIARIES.split(',');

const match_bots_settings = {
  min_vote_power: 9000,
};
const CAMPAIGN_TYPES = {
  REVIEWS: 'reviews',
};

const RESERVATION_STATUSES = {
  ASSIGNED: 'assigned',
  UNASSIGNED: 'unassigned',
  COMPLETED: 'completed',
  REJECTED: 'rejected',
  EXPIRED: 'expired',
  ACTIVE: 'active',
};

const CAMPAIGN_STATUSES = {
  PENDING: 'pending',
  ACTIVE: 'active',
  INACTIVE: 'inactive',
  EXPIRED: 'expired',
  DELETED: 'deleted',
  PAYED: 'payed',
  REACHED_LIMIT: 'reachedLimit',
  ON_HOLD: 'onHold',
  SUSPENDED: 'suspended',
};

const BOT_UPVOTE_STATUSES = {
  UPVOTED: 'upvoted',
  PENDING: 'pending',
};

const activeCampaignStatuses = [CAMPAIGN_STATUSES.ACTIVE, CAMPAIGN_STATUSES.REACHED_LIMIT];

const CAMPAIGN_STATUSES_FOR_ON_HOLD = [
  CAMPAIGN_STATUSES.ACTIVE,
  CAMPAIGN_STATUSES.ON_HOLD,
];

const PAYMENT_HISTORIES_TYPES = {
  REVIEW: 'review',
  TRANSFER: 'transfer',
  CAMPAIGNS_SERVER_FEE: 'campaign_server_fee',
  REFERRAL_SERVER_FEE: 'referral_server_fee',
  BENEFICIARY_FEE: 'beneficiary_fee',
  INDEX_FEE: 'index_fee',
  DEMO_POST: 'demo_post',
  DEMO_USER_TRANSFER: 'demo_user_transfer',
  DEMO_DEBT: 'demo_debt',
  USER_TO_GUEST_TRANSFER: 'user_to_guest_transfer',
  COMPENSATION_FEE: 'compensation_fee',
  OVERPAYMENT_REFUND: 'overpayment_refund',
};

const TRANSFER_TYPES = [
  PAYMENT_HISTORIES_TYPES.TRANSFER,
  PAYMENT_HISTORIES_TYPES.DEMO_DEBT,
];

const MIN_TO_VOTE_VALUE = 0.01;

const votingPowerLimit = 6500;
const maxCampaignsAssign = 500;

const voteCoefficients = {
  100: 0.99,
  90: 0.98,
  80: 0.96,
  70: 0.94,
  60: 0.92,
  50: 0.9,
  40: 0.88,
  30: 0.85,
  20: 0.82,
  10: 0.81,
  0: 0.80,
};

const maxMapRadius = 12100000;
const minCountMapCampaigns = 5;
const INTERNAL_OPERATIONS = 'internal_operations';
const SUSPENDED_DAYS = 30;

const WALLET_TYPES_FOR_PARSE = [
  INTERNAL_OPERATIONS,
  'transfer',
  'transfer_to_vesting',
  'claim_reward_balance',
  'transfer_to_savings',
  'transfer_from_savings',
  'limit_order_cancel',
  'limit_order_create',
  'fill_order',
  'proposal_pay',
];

const GUEST_WALLET_OPERATIONS = [
  PAYMENT_HISTORIES_TYPES.USER_TO_GUEST_TRANSFER,
  PAYMENT_HISTORIES_TYPES.DEMO_POST,
  PAYMENT_HISTORIES_TYPES.DEMO_DEBT,
  PAYMENT_HISTORIES_TYPES.DEMO_USER_TRANSFER,
];

const REFERRAL_TYPES = {
  REWARDS: 'rewards',
};

const REFERRAL_STATUSES = {
  NOT_ACTIVATED: 'notActivated',
  ACTIVATED: 'activated',
  REJECTED: 'rejected',
};

const SORT_TYPES = {
  RECENCY: 'recency',
  EXPIRY: 'expiry',
};
const NOTIFICATIONS_ID = {
  ACTIVATION_CAMPAIGN: 'activationCampaign',
  BELL_WOBJ_REWARDS: 'bellWobjectRewards',
};

const SECONDS_IN_DAY = 24 * 3600;
const GPS_DIFF = 0.01;

module.exports = {
  SORT_TYPES,
  REFERRAL_TYPES,
  TRANSFER_TYPES,
  SUSPENDED_DAYS,
  MIN_TO_VOTE_VALUE,
  REFERRAL_STATUSES,
  BOT_UPVOTE_STATUSES,
  RESERVATION_STATUSES,
  CAMPAIGN_STATUSES,
  CAMPAIGN_TYPES,
  PAYMENT_HISTORIES_TYPES,
  INTERNAL_OPERATIONS,
  maxMapRadius,
  minCountMapCampaigns,
  voteCoefficients,
  votingPowerLimit,
  maxCampaignsAssign,
  match_bots_settings,
  specialTransferBeneficiaries,
  activeCampaignStatuses,
  WALLET_TYPES_FOR_PARSE,
  GUEST_WALLET_OPERATIONS,
  CAMPAIGN_STATUSES_FOR_ON_HOLD,
  NOTIFICATIONS_ID,
  SECONDS_IN_DAY,
  GPS_DIFF,
};
