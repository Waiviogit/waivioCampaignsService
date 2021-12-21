const validators = require('controllers/validators');

const { renderError, renderSuccess } = require('concerns/renderConcern');
const { getAccountHistory } = require('../utilities/operations/account/getHistory');

const accountHistory = async (req, res) => {
  const { params, validationError } = validators.validate(
    req.body,
    validators.account.validateAccountHistorySchema,
  );

  if (validationError) return renderError(res, validationError);

  const { history, error } = await getAccountHistory(params);

  if (error) renderError(res, { message: error });

  renderSuccess(res, { history });
};

module.exports = {
  accountHistory,
};
