const express = require('express');
const dotenv = require('dotenv');

dotenv.config({ path: `env/${process.env.NODE_ENV || 'development'}.env` });
const { routes } = require('routes');
const { startExpiredListener } = require('utilities/redis/expireListener');

const app = express();

require('./enviroment.js')(app, express);
require('./jobs/matchBotsJob');
require('./jobs/campaignsStatusJob');

if (process.env.NODE_ENV === 'production') {
  require('utilities/helpers/createTTLHelper');
  require('./jobs/claimRewardsJob');
}

app.use('/', routes);
startExpiredListener();

module.exports = app;
