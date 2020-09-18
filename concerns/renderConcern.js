const _ = require('lodash');

const renderError = (res, message) => res.status(422).json({ success: false, message });

const renderSuccess = (res, data) => res.status(200).json(data);

const renderNotFound = (res, data) => res.status(404).json(data);

const renderForbidden = (res, error) => res.status(403).json(error);

const renderCustomError = (res, error) => res.status(_.get(error, 'status', 500)).json({ message: _.get(error, 'message', 'Internal server error') });

const unauthorized = (res, data) => res.status(401).send({
  success: false,
  message: data || 'No token provided.',
});

module.exports = {
  renderError, renderSuccess, renderNotFound, renderForbidden, unauthorized, renderCustomError,
};
