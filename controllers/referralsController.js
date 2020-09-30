const validators = require('controllers/validators');
const { referrals: { getDetails, getStatus, checkBlackList } } = require('utilities/operations');
const { renderSuccess, renderError, renderCustomError } = require('concerns/renderConcern');

const details = async (req, res) => {
  const { result, error } = await getDetails();

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

const blackList = async (req, res) => {
  const {
    params,
    validationError,
  } = validators.validate(Object.assign(req.query, { host: req.headers.host }), validators.referrals.blackListSchema);
  if (validationError) return renderError(res, { message: validationError });

  const { isBlacklisted, error } = await checkBlackList(params);

  if (error) renderCustomError(res, error);
  else renderSuccess(res, { isBlacklisted });
};

module.exports = { details, status, blackList };
