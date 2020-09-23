const { blackLists: { getBlackList } } = require('utilities/operations');
const { renderSuccess, renderError, renderCustomError } = require('concerns/renderConcern');

const show = async (req, res, next) => {
  try {
    if (!req.params.guideName) return renderError(res, { error: 'guideName is required!' });

    const { blackList, error } = await getBlackList(req.params.guideName);

    if (error) renderCustomError(res, error);
    else renderSuccess(res, { blackList });
  } catch (e) {
    return next({ status: 500, message: e.message });
  }
};

module.exports = {
  show,
};
