const {
  paymentHistory: {
    getWalletAdvancedReport,
    checkPayableWarning,
    getTransfersHistory,
    getDemoDebtHistory,
    getPayableHistory,
    walletExemptions,
    getSingleReport,
    pendingTransfer,
  },
} = require('utilities/operations');
const { renderSuccess, renderError, renderCustomError } = require('concerns/renderConcern');
const authoriseUser = require('utilities/authorization/authoriseUser');
const validators = require('controllers/validators');

/*
Return all payable for sponsor(if in request !userName && sponsor),
all receivables for user(if in request userName && !sponsor)
payable for sponsor to current user(if in request userName && sponsor)
if in request !userName && !sponsor return empty array.
Optional fields:
  <skip> - skip first (skipValue) results (default 0)
  <limit> - limit for data which will be found (default 0)
  <payable> - with this field return all results $gte payable
  <days> - with this field return all results $lte (today - days)  (default 0)
  <sort> - valid ['payable', 'date'] sort by valid values -1  (default payable)
 */
exports.payableHistory = async (req, res) => {
  const {
    params,
    validationError,
  } = validators.validate(req.body, validators.payables.payablesSchema);

  if (validationError) return renderError(res, validationError);
  const {
    histories, payable, amount, hasMore, error, notPayedPeriod,
  } = await getPayableHistory(params);

  if (error) renderCustomError(res, error);
  else {
    renderSuccess(res, {
      histories, payable, amount, hasMore, notPayedPeriod,
    });
  }
};

/*
Return payments history for demo users
 <skip> - skip first (skipValue) results (default 0)
  <limit> - limit for data which will be found (default 0)
  <userName> - name of demo user
 */
exports.demoDeptHistory = async (req, res) => {
  const {
    params,
    validationError,
  } = validators.validate(req.query, validators.payables.demoDeptSchema);
  const accessToken = req.headers['access-token'];
  if (validationError) return renderError(res, validationError);
  const {
    histories, payable, error, hasMore, deposits, withdrawals,
  } = await getDemoDebtHistory(params, accessToken);

  if (error) renderError(res, { error });
  else {
    renderSuccess(res, {
      histories, payable, hasMore, deposits, withdrawals,
    });
  }
};

exports.transfersHistory = async (req, res) => {
  const {
    params,
    validationError,
  } = validators.validate(req.query, validators.payables.demoDeptSchema);

  if (validationError) return renderError(res, validationError);
  const {
    wallet, error, hasMore, operationNum, withdrawals, deposits,
  } = await getTransfersHistory(params);

  if (error) renderCustomError(res, error);
  else {
    renderSuccess(res, {
      wallet, operationNum, hasMore, withdrawals, deposits,
    });
  }
};

exports.report = async (req, res) => {
  const {
    params,
    validationError,
  } = validators.validate(req.body, validators.payables.reportSchema);

  if (validationError) return renderError(res, validationError);
  const { result, error } = await getSingleReport(params);
  if (error) renderCustomError(res, error);
  else renderSuccess(res, { ...result });
};

exports.setPendingTransfer = async (req, res) => {
  const {
    params,
    validationError,
  } = validators.validate(req.body, validators.payables.pendingTransfer);
  if (validationError) return renderError(res, validationError);
  const { result, error } = await pendingTransfer(params);
  if (error) renderCustomError(res, error);
  else renderSuccess(res, { result });
};

exports.payableWarning = async (req, res) => {
  const {
    params,
    validationError,
  } = validators.validate(req.query, validators.payables.warningPayables);
  if (validationError) return renderError(res, validationError);
  const { warning, error } = await checkPayableWarning(params);
  if (error) return renderCustomError(res, error);
  renderSuccess(res, { warning });
};

exports.advancedReport = async (req, res) => {
  const { params, validationError } = validators.validate(
    { ...req.body, ...req.headers },
    validators.payables.advancedWalletSchema,
  );

  if (validationError) return renderError(res, validationError);

  const result = await getWalletAdvancedReport(params);
  if (result.error) return renderCustomError(res, result.error);
  renderSuccess(res, result);
};

exports.createWalletExemptions = async (req, res) => {
  const { params, validationError } = validators
    .validate(req.body, validators.payables.walletExemptionsSchema);

  if (validationError) return renderError(res, validationError);

  const { error: authError } = await authoriseUser.authorise(params.userName);
  if (authError) return renderCustomError(res, authError);

  const { result, error } = await walletExemptions.addOrDeleteExemption(params);

  if (error) return renderCustomError(res, error);
  renderSuccess(res, { result });
};
