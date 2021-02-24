const logger = require('morgan');
const { runStream, runStreamRest } = require('processor/processor');
const Tracing = require('@sentry/tracing');
const swaggerUi = require('swagger-ui-express');
const swaggerDocument = require('swagger');
const { createNamespace } = require('cls-hooked');
const cors = require('cors');
const Sentry = require('@sentry/node');
const { routes } = require('routes');
const { siteUserStatistics } = require('middlewares');
const { REPLACE_ORIGIN, REPLACE_REFERER } = require('constants/regExp');

require('jobs/matchBotsJob');
const { sendSentryNotification } = require('utilities/requests/telegramNotificationsRequest');

module.exports = function (app, express) {
  Sentry.init({
    environment: process.env.NODE_ENV,
    dsn: process.env.SENTRY_DNS,
    integrations: [
      // enable HTTP calls tracing
      new Sentry.Integrations.Http({ tracing: true }),
      // enable Express.js middleware tracing
      new Tracing.Integrations.Express({ app }),
    ],
  });

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

  const session = createNamespace('request-session');
  app.use((req, res, next) => {
    session.run(() => next());
  });
  app.use((req, res, next) => {
    let { origin, referer } = req.headers;
    origin
      ? origin = origin.replace(REPLACE_ORIGIN, '')
      : origin = referer && referer.replace(REPLACE_REFERER, '');

    session.set('host', origin);
    next();
  });

  // ### Sentry enviroments ###
  app.use(Sentry.Handlers.requestHandler({ request: true, user: true }));
  app.use('/', siteUserStatistics.saveUserIp);
  app.use('/', routes);
  app.use(Sentry.Handlers.errorHandler({
    shouldHandleError(error) {
      // Capture 500 errors
      if (error.status >= 500 || !error.status) {
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
    res.status(err.status || 500).json({ message: err.message || 'Internal server error' });
  });
};
