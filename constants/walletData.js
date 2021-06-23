const { HIVE_OPERATIONS_TYPES, PAYMENT_HISTORIES_TYPES } = require('constants/constants');

exports.SAVINGS_TRANSFERS = ['transfer_from_savings', 'transfer_to_savings'];

exports.WALLET_TYPES = {
  TRANSFER: 'transfer',
  CLAIM_REWARD_BALANCE: 'claim_reward_balance',
};

exports.CURRENCIES = {
  HIVE: 'HIVE',
  HBD: 'HBD',
  HP: 'HP',
  USD: 'usd',
};

exports.ACCOUNT_FILTER_TYPES = [
  HIVE_OPERATIONS_TYPES.TRANSFER,
  HIVE_OPERATIONS_TYPES.TRANSFER_TO_VESTING,
  HIVE_OPERATIONS_TYPES.FILL_VESTING_WITHDRAW,
  PAYMENT_HISTORIES_TYPES.USER_TO_GUEST_TRANSFER,
  PAYMENT_HISTORIES_TYPES.DEMO_USER_TRANSFER,
  PAYMENT_HISTORIES_TYPES.DEMO_POST,
  PAYMENT_HISTORIES_TYPES.DEMO_DEBT,
];
