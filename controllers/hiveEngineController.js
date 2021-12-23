const { renderSuccess, renderError } = require('concerns/renderConcern');
const swap = require('utilities/operations/hiveEngineOps/swap');

exports.getSwapParams = async (req, res) => {
  const { result, error } = await swap.getSwapParams();

  if (error) renderError(res, { error });
  else renderSuccess(res, result);
};
