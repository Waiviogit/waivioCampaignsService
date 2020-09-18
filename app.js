const express = require('express');
const { routes } = require('routes');
const { startExpiredListener } = require('utilities/helpers/expirationHelper');

const app = express();

global._ = require('lodash');


require('./jobs/matchBotsJob');
require('./jobs/campaignsStatusJob');
require('./enviroment.js')(app, express);

if (process.env.NODE_ENV === 'production') {
  require('utilities/helpers/createTTLHelper');
  require('./jobs/claimRewardsJob');
}

app.use('/', routes);
startExpiredListener();

module.exports = app;
