const validators = require('controllers/validators');

const { renderError, renderSuccess } = require('concerns/renderConcern');
const { getHistory } = require('../utilities/operations').account;

const accountHistory = async (req, res) => {
  const { params, validationError } = validators.validate(
    req.query,
    validators.account.validateAccountHistorySchema,
  );

  if (validationError) return renderError(res, validationError);

  const { history, error } = await getHistory(params);

  if (error) renderError(res, { message: error });

  renderSuccess(res, { history });
};

module.exports = {
  accountHistory,
};
