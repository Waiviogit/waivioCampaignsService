const { renderSuccess, renderError } = require('concerns/renderConcern');
const getBots = require('utilities/operations/matchBots/getBots');
const { getMatchBots } = require('models/matchBotModel');
const validators = require('controllers/validators');

/**
 * Found all allowed sponsors for match bot which sent in request
 */
exports.sponsorMatchBots = async (req, res) => {
  const {
    params,
    validationError,
  } = validators.validate(req.query, validators.matchBots.sponsorMatchBotsSchema);

  if (validationError) return renderError(res, validationError);
  const { results, votingPower, error } = await getMatchBots(params);

  if (error) renderError(res, { error });
  else renderSuccess(res, { results, votingPower });
};

exports.getMatchBots = async (req, res) => {
  const {
    params,
    validationError,
  } = validators.validate({ ...req.query, ...req.params }, validators.matchBots.getMatchBotsSchema);
  if (validationError) return renderError(res, validationError);
  const { result, hasMore, error } = await getBots.getBotByType(params);

  if (error) renderError(res, { error });
  else renderSuccess(res, { result, hasMore });
};
