const validators = require('controllers/validators');

const { renderError, renderSuccess } = require('concerns/renderConcern');
const { getHistory } = require('../utilities/operations').account;

const accountHistory = async (req, res) => {
  const { params, validationError } = validators.validate(
    req.query,
    validators.account.validateAccountHistorySchema,
  );

  if (validationError) return renderError(res, validationError);

  const { history } = await getHistory(params);

  renderSuccess(res, { history });
};

module.exports = {
  accountHistory,
};
