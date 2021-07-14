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

const CAMPAIGN_SORTS = {
  REWARD: 'reward',
  DATE: 'date',
  PROXIMITY: 'proximity',
  PAYOUT: 'payout',
  DEFAULT: 'default',
};

const CAMPAIGN_PAYMENT_SORTS = [
  CAMPAIGN_SORTS.PAYOUT,
  CAMPAIGN_SORTS.DEFAULT,
];

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

const REVIEW_TYPES = [
  PAYMENT_HISTORIES_TYPES.REVIEW,
  PAYMENT_HISTORIES_TYPES.CAMPAIGNS_SERVER_FEE,
  PAYMENT_HISTORIES_TYPES.REFERRAL_SERVER_FEE,
  PAYMENT_HISTORIES_TYPES.BENEFICIARY_FEE,
  PAYMENT_HISTORIES_TYPES.INDEX_FEE,
  PAYMENT_HISTORIES_TYPES.COMPENSATION_FEE,
  PAYMENT_HISTORIES_TYPES.OVERPAYMENT_REFUND,
];

const NOT_PAYED_DEBT_TYPES = [
  PAYMENT_HISTORIES_TYPES.REVIEW,
  PAYMENT_HISTORIES_TYPES.CAMPAIGNS_SERVER_FEE,
  PAYMENT_HISTORIES_TYPES.REFERRAL_SERVER_FEE,
  PAYMENT_HISTORIES_TYPES.BENEFICIARY_FEE,
  PAYMENT_HISTORIES_TYPES.INDEX_FEE,
  PAYMENT_HISTORIES_TYPES.COMPENSATION_FEE,
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

const HIVE_OPERATIONS_TYPES = {
  INTERNAL_OPERATIONS,
  TRANSFER: 'transfer',
  TRANSFER_TO_VESTING: 'transfer_to_vesting',
  CLAIM_REWARD_BALANCE: 'claim_reward_balance',
  TRANSFER_TO_SAVINGS: 'transfer_to_savings',
  TRANSFER_FROM_SAVINGS: 'transfer_from_savings',
  LIMIT_ORDER_CREATE: 'limit_order_create',
  LIMIT_ORDER_CANCEL: 'limit_order_cancel',
  FILL_ORDER: 'fill_order',
  PROPOSAL_PAY: 'proposal_pay',
  WITHDRAW_VESTING: 'withdraw_vesting',
  FILL_VESTING_WITHDRAW: 'fill_vesting_withdraw',
};

const WALLET_TYPES_FOR_PARSE = Object.values(HIVE_OPERATIONS_TYPES);

const ADVANCED_WALLET_TYPES = [
  INTERNAL_OPERATIONS,
  HIVE_OPERATIONS_TYPES.TRANSFER,
  HIVE_OPERATIONS_TYPES.TRANSFER_TO_VESTING,
  HIVE_OPERATIONS_TYPES.CLAIM_REWARD_BALANCE,
  HIVE_OPERATIONS_TYPES.TRANSFER_TO_SAVINGS,
  HIVE_OPERATIONS_TYPES.TRANSFER_FROM_SAVINGS,
  HIVE_OPERATIONS_TYPES.LIMIT_ORDER_CANCEL,
  HIVE_OPERATIONS_TYPES.FILL_ORDER,
  HIVE_OPERATIONS_TYPES.PROPOSAL_PAY,
  HIVE_OPERATIONS_TYPES.FILL_VESTING_WITHDRAW,
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

const GUEST_BNF_ACC = 'waivio.hpower';

const DEVICE = {
  MOBILE: 'mobile',
};

const DAYS_TO_PAYABLE_WARNING = 21;

const CAMPAIGN_FIELDS_FOR_CARDS = [
  'reservation_timetable',
  'activation_permlink',
  'userRequirements',
  'frequency_assign',
  'requiredObject',
  'requirements',
  'description',
  'expired_at',
  'updatedAt',
  'createdAt',
  'reward',
  'object',
  'status',
  'guide',
  'name',
];

const SUPPORTED_CURRENCIES = {
  USD: 'USD',
  CAD: 'CAD',
  EUR: 'EUR',
  AUD: 'AUD',
  MXN: 'MXN',
  GBP: 'GBP',
  JPY: 'JPY',
  CNY: 'CNY',
  RUB: 'RUB',
  UAH: 'UAH',
};

const SUPPORTED_CRYPTO_CURRENCIES = {
  HIVE: 'HIVE',
  HBD: 'HBD',
  HP: 'HP',
};

const PAYABLES_CURRENCIES = [
  ...Object.values(SUPPORTED_CURRENCIES),
  SUPPORTED_CRYPTO_CURRENCIES.HIVE,
];

const DONT_GET_RATES = [
  SUPPORTED_CRYPTO_CURRENCIES.HIVE,
  SUPPORTED_CURRENCIES.USD,
];

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
  CAMPAIGN_SORTS,
  CAMPAIGN_PAYMENT_SORTS,
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
  GUEST_BNF_ACC,
  DEVICE,
  REVIEW_TYPES,
  DAYS_TO_PAYABLE_WARNING,
  CAMPAIGN_FIELDS_FOR_CARDS,
  ADVANCED_WALLET_TYPES,
  NOT_PAYED_DEBT_TYPES,
  HIVE_OPERATIONS_TYPES,
  SUPPORTED_CURRENCIES,
  SUPPORTED_CRYPTO_CURRENCIES,
  PAYABLES_CURRENCIES,
  DONT_GET_RATES,
};
