exports.MATCH_BOT_TYPES = {
  CURATOR: 'curator',
  AUTHOR: 'author',
};

exports.BOTS_QUEUE = {
  CURATOR: {
    NAME: 'curatorsBotQueue',
    DELAY: 300,
    MIN_HBD: 0.01,
  },
  AUTHOR: {
    NAME: 'authorsBotQueue',
    DELAY: 300,
    MIN_HBD: 0.01,
  },
  ENGINE_CURATOR: {
    NAME: 'engineCuratorBotQueue',
    DELAY: 1,
    MIN_PERCENTAGE: 7000,
    VOTED_KEY: 'engineCuratorVoted',
    DAILY_WEIGHT: 100000,
  },
};

exports.BOT_ENV_KEY = {
  CURATOR: 'CURATOR_BOT_KEY',
  AUTHOR: 'AUTHOR_BOT_KEY',
};

exports.WORK_BOTS_ENV = [
  'test',
  'production',
];

exports.MANA_CHECK_TYPES = [
  'HIVE',
  'WAIV',
];

exports.GREY_LIST_KEY = 'vote_grey_list';
