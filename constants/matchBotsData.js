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
};

exports.BOT_ENV_KEY = {
  CURATOR: 'CURATOR_BOT_KEY',
  AUTHOR: 'AUTHOR_BOT_KEY',
};
