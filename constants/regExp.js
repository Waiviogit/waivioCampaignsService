exports.REPLACE_ORIGIN = new RegExp(/(https:\/\/|http:\/\/|www\.)/g);

exports.REPLACE_REFERER = new RegExp(/(https:\/\/|http:\/\/|www\.|\/.+$|\/)/g);

exports.RPC_MESSAGES = {
  IGNORED_VOTE_ERRORS: new RegExp(/(your current vote on this comment is identical to this vote|can only vote once every 3 seconds)/gmi),
};
