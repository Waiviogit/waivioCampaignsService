const validators = require('controllers/validators');
const { referrals: { getDetails, getStatus } } = require('utilities/operations');
const { renderSuccess, renderError, renderCustomError } = require('concerns/renderConcern');

const details = async (req, res) => {
  if (!req.query.appName) return renderError(res, { error: 'Name of app is required' });
  const { result, error } = await getDetails(req.query.appName);

  if (error) renderCustomError(res, error);
  else renderSuccess(res, result);
};

const status = async (req, res) => {
  const {
    params,
    validationError,
  } = validators.validate(req.query, validators.referrals.statusSchema);
  if (validationError) return renderError(res, { message: validationError });

  const { users, hasMore, error } = await getStatus(params);

  if (error) renderCustomError(res, error);
  else renderSuccess(res, { users, hasMore });
};

module.exports = { details, status };
