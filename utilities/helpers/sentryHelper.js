const { sendSentryNotification } = require('utilities/requests/telegramNotificationsRequest');
const Sentry = require('@sentry/node');

exports.handleError = async (error) => {
  await sendSentryNotification();
  Sentry.captureException(error);
};
