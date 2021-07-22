exports.MATCH_BOT_TYPES = {
  SPONSOR: 'sponsor',
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
