const { Client } = require('@hiveio/dhive');
const { nodeUrls } = require('constants/appData');

exports.broadcastClient = new Client(nodeUrls, { failoverThreshold: 0, timeout: 10 * 1000 });
exports.databaseClient = new Client(nodeUrls, { failoverThreshold: 0, timeout: 10 * 1000 });
