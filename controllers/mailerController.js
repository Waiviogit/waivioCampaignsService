const _ = require('lodash');
const validators = require('controllers/validators');
const config = require('config');
const { renderCustomError, renderSuccess, renderError } = require('concerns/renderConcern');
const {
  mailer: { confirmationEmailRequest, confirmationEmailResponse, confirmationEmailMiddleware },
} = require('utilities/operations');

exports.confirmEmailRequest = async (req, res) => {
  const accessToken = req.headers['access-token'];
  const { params, validationError } = validators.validate(
    Object.assign(req.body, { accessToken }), validators.mailer.confirmRequestSchema,
  );
  if (validationError) return renderError(res, validationError.message);

  const { error, result } = await confirmationEmailRequest(params);
  if (error) return renderCustomError(res, { status: _.get(error, 'response.status', 403), message: _.get(error, 'response.statusText') });
  renderSuccess(res, { result: !!result });
};

exports.confirmEmailResponse = async (req, res) => {
  const { params, validationError } = validators.validate(
    req.query, validators.mailer.confirmResponseSchema,
  );
  if (validationError) return renderError(res, validationError.message);

  const { error, result } = await confirmationEmailResponse(params);
  if (error) return res.redirect(307, `${config.waivioUrl}confirmation?id=${error.id}&userName=${params.userName}`);
  res.redirect(307, `${config.waivioUrl}confirmation?id=${result.id}&userName=${params.userName}`);
};

exports.confirmEmailInTransaction = async (req, res) => {
  const { query } = req;
  await confirmationEmailMiddleware(query);
  res.redirect(307, `${config.waivioUrl}confirmation?id=${query.id}&userName=${query.userName}&token=${query.token}&reqAmount=${query.reqAmount}&inputCoinType=${query.inputCoinType}&outputCoinType=${query.outputCoinType}&depositAcc=${query.depositAcc}&memo=${query.memo}&commission=${query.commission}`);
};
