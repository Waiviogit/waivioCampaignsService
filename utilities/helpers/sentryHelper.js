const Sentry = require('@sentry/node');

exports.captureException = (error) => {
  if (process.env.NODE_ENV === 'production') {
    Sentry.captureException(error);
  } else console.error(error);
};
