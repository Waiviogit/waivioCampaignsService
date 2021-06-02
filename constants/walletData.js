const { HIVE_OPERATIONS_TYPES } = require('constants/constants');

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
];
