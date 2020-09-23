const logger = require('morgan');
const { runStream, runStreamRest } = require('processor/processor');
const swaggerUi = require('swagger-ui-express');
const swaggerDocument = require('swagger');
const cors = require('cors');
const Sentry = require('@sentry/node');
const { routes } = require('routes');

require('jobs/matchBotsJob');
const { sendSentryNotification } = require('utilities/requests/telegramNotificationsRequest');

module.exports = function (app, express) {
  Sentry.init({ environment: process.env.NODE_ENV, dsn: process.env.SENTRY_DNS });
  app.use(cors());
  app.use(logger('dev'));
  app.use(express.json());
  app.use(express.urlencoded({ extended: false }));
  app.use('/campaigns-api/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));
  // ### STEEM stream ###
  if (process.env.NODE_ENV !== 'test') {
    runStream().catch((err) => {
      Sentry.captureException(err);
      sendSentryNotification();
      console.error(err);
      process.exit(1);
    });
    runStreamRest().catch((err) => {
      Sentry.captureException(err);
      sendSentryNotification();
      console.error(err);
      process.exit(1);
    });
  }

  // ### Sentry enviroments ###

  app.use(Sentry.Handlers.requestHandler());
  app.use('/', routes);
  app.use(Sentry.Handlers.errorHandler({
    shouldHandleError(error) {
      // Capture 500 errors
      if (error.status >= 500) {
        sendSentryNotification();
        return true;
      }
      return false;
    },
  }));

  process.on('unhandledRejection', (error) => {
    sendSentryNotification();
    Sentry.captureException(error);
  });

  app.use((err, req, res, next) => {
    // The error id is attached to `res.sentry` to be returned
    // and optionally displayed to the user for support.
    res.statusCode = err.status || 500;
    res.end(`${res.sentry}\n`);
  });
};
