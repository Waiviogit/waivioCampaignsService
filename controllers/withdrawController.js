const _ = require('lodash');
const validators = require('controllers/validators');
const { renderCustomError, renderSuccess, renderError } = require('concerns/renderConcern');
const {
  withdraw: {
    getOutputAmount, validateCryptoWallet, confirmTransaction, createDemoPayment, transactionStatus,
  },
} = require('utilities/operations');

exports.estimateAmount = async (req, res, next) => {
  try {
    const { params, validationError } = validators.validate(
      req.query, validators.withdraw.outputSchema,
    );
    if (validationError) return renderError(res, validationError.message);

    const { result, error } = await getOutputAmount(params);
    if (error) return renderCustomError(res, { status: _.get(error, 'response.status', 403), message: _.get(error, 'response.statusText') });
    renderSuccess(res, result);
  } catch (e) {
    return next({ status: 500, message: e.message });
  }
};

exports.validateWallet = async (req, res, next) => {
  try {
    const { params, validationError } = validators.validate(
      req.query, validators.withdraw.validateWalletSchema,
    );
    if (validationError) return renderError(res, validationError.message);

    const { result, error } = await validateCryptoWallet(params);

    if (error) return renderCustomError(res, { status: _.get(error, 'response.status', 403), message: _.get(error, 'response.statusText') });
    renderSuccess(res, result);
  } catch (e) {
    return next({ status: 500, message: e.message });
  }
};

exports.finalConfirm = async (req, res, next) => {
  try {
    if (!req.query.id || !req.headers['access-token']) return renderError(res, 'id and access-token is required!');

    const { result, error } = await confirmTransaction(req.query.id, req.headers['access-token']);

    if (error) return renderCustomError(res, error);
    renderSuccess(res, result);
  } catch (e) {
    return next({ status: 500, message: e.message });
  }
};

exports.demoPayment = async (req, res, next) => {
  try {
    if (req.headers.secret !== process.env.API_KEY) return renderCustomError(res);
    const { params, validationError } = validators.validate(
      req.body, validators.withdraw.demoDebtSchema,
    );
    if (validationError) return renderError(res, validationError.message);

    const { result, error } = await createDemoPayment(params);
    if (error) return renderCustomError(res, error);
    renderSuccess(res, { result });
  } catch (e) {
    return next({ status: 500, message: e.message });
  }
};

exports.getTransactionStatus = async (req, res, next) => {
  try {
    if (!req.query.id) return renderError(res, 'id is required!');

    const { result, error } = await transactionStatus(req.query.id);
    if (error) return renderCustomError(res, error);
    renderSuccess(res, result);
  } catch (e) {
    return next({ status: 500, message: e.message });
  }
};
