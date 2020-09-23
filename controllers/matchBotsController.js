const validators = require('controllers/validators');
const { getMatchBots } = require('models/matchBotModel');
const { renderSuccess, renderError } = require('concerns/renderConcern');

/**
 * Found all allowed sponsors for match bot which sent in request
 */
const sponsorMatchBots = async (req, res, next) => {
  try {
    const {
      params,
      validationError,
    } = validators.validate(req.query, validators.matchBots.sponsorMatchBotsSchema);

    if (validationError) return renderError(res, validationError);
    const { results, votingPower, error } = await getMatchBots(params);

    if (error) renderError(res, { error });
    else renderSuccess(res, { results, votingPower });
  } catch (e) {
    return next({ status: 500, message: e.message });
  }
};

module.exports = {
  sponsorMatchBots,
};
