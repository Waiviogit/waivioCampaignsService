exports.REPLACE_ORIGIN = new RegExp(/(https:\/\/|http:\/\/|www\.)/g);

exports.REPLACE_REFERER = new RegExp(/(https:\/\/|http:\/\/|www\.|\/.+$|\/)/g);

exports.RPC_MESSAGES = {
  SAME_VOTE: new RegExp(/your current vote on this comment is identical to this vote/gmi),
};
