const {
  paymentHistory: {
    getDemoDebtHistory, getPayableHistory, getTransfersHistory, getSingleReport, pendingTransfer,
  },
} = require('utilities/operations');
const { renderSuccess, renderError, renderCustomError } = require('concerns/renderConcern');
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
const payableHistory = async (req, res) => {
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
const demoDeptHistory = async (req, res) => {
  const {
    params,
    validationError,
  } = validators.validate(req.query, validators.payables.demoDeptSchema);
  const accessToken = req.headers['access-token'];
  if (validationError) return renderError(res, validationError);
  const {
    histories, payable, error, hasMore,
  } = await getDemoDebtHistory(params, accessToken);

  if (error) renderError(res, { error });
  else renderSuccess(res, { histories, payable, hasMore });
};

const transfersHistory = async (req, res) => {
  const {
    params,
    validationError,
  } = validators.validate(req.query, validators.payables.demoDeptSchema);

  if (validationError) return renderError(res, validationError);
  const {
    wallet, error, hasMore, operationNum,
  } = await getTransfersHistory(params);

  if (error) renderCustomError(res, error);
  else {
    renderSuccess(res, {
      wallet, operationNum, hasMore,
    });
  }
};

const report = async (req, res) => {
  const {
    params,
    validationError,
  } = validators.validate(req.body, validators.payables.reportSchema);

  if (validationError) return renderError(res, validationError);
  const { result, error } = await getSingleReport(params);
  if (error) renderCustomError(res, error);
  else renderSuccess(res, { ...result });
};

const setPendingTransfer = async (req, res) => {
  const {
    params,
    validationError,
  } = validators.validate(req.body, validators.payables.pendingTransfer);
  if (validationError) return renderError(res, validationError);
  const { result, error } = await pendingTransfer(params);
  if (error) renderCustomError(res, error);
  else renderSuccess(res, { result });
};

module.exports = {
  transfersHistory,
  demoDeptHistory,
  payableHistory,
  report,
  setPendingTransfer,
};
