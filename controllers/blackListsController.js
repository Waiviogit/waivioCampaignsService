const { blackLists: { getBlackList } } = require('utilities/operations');
const { renderSuccess, renderError, renderCustomError } = require('concerns/renderConcern');

const show = async (req, res) => {
  if (!req.params.guideName) return renderError(res, { error: 'guideName is required!' });

  const { blackList, error } = await getBlackList(req.params.guideName);

  if (error) renderCustomError(res, error);
  else renderSuccess(res, { blackList });
};

module.exports = {
  show,
};
