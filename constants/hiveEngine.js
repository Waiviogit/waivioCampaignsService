exports.TOKEN_WAIV = {
  SYMBOL: 'WAIV',
  POOL_ID: 13,
  DIESEL_POOL_ID: 63,
  TAGS: ['waivio', 'neoxian', 'palnet', 'waiv', 'food'],
  FRACTION_PRECISION: 8,
  MAX_LIMIT: 1000,
};
exports.HISTORY_OPERATION_TYPES = {
  CURATION_REWARDS: 'comments_curationReward',
  AUTHOR_REWARDS: 'comments_authorReward',
  BENEFICIARY_REWARD: 'comments_beneficiaryReward',
};

exports.REDIS_ENGINE_CURATORS = 'engineCurators';

exports.MARKET_CONTRACT = {
  BUY: 'buy',
  SELL: 'sell',
};

exports.MARKET_OPERATION = {
  PLACE_ORDER: 'market_placeOrder',
};

exports.HISTORY_API_OPS = [
  'tokens_create',
  'tokens_issue',
  'tokens_transfer',
  'tokens_transferToContract',
  'tokens_transferFromContract',
  'tokens_updatePrecision',
  'tokens_updateUrl',
  'tokens_updateMetadata',
  'tokens_transferOwnership',
  'tokens_enableStaking',
  'tokens_enableDelegation',
  'tokens_stake',
  'tokens_unstakeStart',
  'tokens_cancelUnstake',
  'tokens_delegate',
  'tokens_undelegateStart',
  'tokens_undelegateDone',
  'tokens_transferFee',
  'market_cancel',
  'market_placeOrder',
  'market_expire',
  'market_buy',
  'market_buyRemaining',
  'market_sell',
  'market_sellRemaining',
  'market_close',
  'mining_lottery',
  'witnesses_proposeRound',
  'hivepegged_buy',
  'hivepegged_withdraw',
];

exports.MAX_VOTING_POWER = 10000;
exports.VOTE_REGENERATION_DAYS = 5;
exports.DOWNVOTE_REGENERATION_DAYS = 5;

exports.HIVE_ENGINE_NODES = [
  'https://api.hive-engine.com/rpc', // Germany
  'https://api2.hive-engine.com/rpc', // Finland
  'https://herpc.dtools.dev', // Miami
  'https://us.engine.rishipanthee.com', // Finland
  'https://ha.herpc.dtools.dev', // New Jersey
];
