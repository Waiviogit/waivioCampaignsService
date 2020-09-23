const { demoUsersHelper } = require('utilities/helpers');
const { renderSuccess, renderError } = require('concerns/renderConcern');
const validators = require('controllers/validators');

/**
 * This controller provides transfers tokens from guest users to usual users,
 * The method 'transfer' checks if the user really has the number of tokens
 * that he wants to send, transfer itself is carried out using WaivioBank,
 * then parser parsed record from blockchain and a record is created with
 * type 'demo_user_transfer' in the transfer database.
 */
const transfer = async (req, res, next) => {
  try {
    const {
      params,
      validationError,
    } = validators.validate(req.body.data, validators.demoUsers.transferSchema);

    if (validationError) return renderError(res, { message: validationError });
    params.demoUser = req.user.name;
    const { result, error } = await demoUsersHelper.transfer(params);

    if (error) renderError(res, { message: error });
    else renderSuccess(res, { json: { result } });
  } catch (e) {
    return next({ status: 500, message: e.message });
  }
};

module.exports = {
  transfer,
};
