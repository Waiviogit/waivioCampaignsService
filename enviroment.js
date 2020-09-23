const logger = require('morgan');
const { runStream, runStreamRest } = require('processor/processor');
const swaggerUi = require('swagger-ui-express');
const swaggerDocument = require('swagger');
const cors = require('cors');
const Sentry = require('@sentry/node');

require('jobs/matchBotsJob');

module.exports = function (app, express) {
  Sentry.init({ dsn: process.env.SENTRY_DNS });
  app.use(cors());
  app.use(logger('dev'));
  app.use(express.json());
  app.use(express.urlencoded({ extended: false }));
  app.use('/campaigns-api/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));
  // ### STEEM stream ###
  if (process.env.NODE_ENV !== 'test') {
    runStream().catch((err) => {
      if (process.env.NODE_ENV === 'production') {
        Sentry.captureException(err);
      }
      console.error(err);
      process.exit(1);
    });
    runStreamRest().catch((err) => {
      if (process.env.NODE_ENV === 'production') {
        Sentry.captureException(err);
      }
      console.error(err);
      process.exit(1);
    });
  }

  // ### Sentry enviroments ###
  if (process.env.NODE_ENV === 'production') {
    app.use(Sentry.Handlers.requestHandler());
    app.use(Sentry.Handlers.errorHandler({
      shouldHandleError(error) {
        // Capture 500 errors
        if (error.status === 500) {
          return true;
        }
        return false;
      },
    }));
  }

  app.use((err, req, res, next) => {
    // The error id is attached to `res.sentry` to be returned
    // and optionally displayed to the user for support.
    res.statusCode = 500;
    res.end(`${res.sentry}\n`);
  });
};
