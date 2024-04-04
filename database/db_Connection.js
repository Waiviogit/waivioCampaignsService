const mongoose = require('mongoose');
const config = require('config');

const URI = process.env.MONGO_URI_WAIVIO
  ? process.env.MONGO_URI_WAIVIO
  : `mongodb://${config.db.host}:${config.db.port}/${config.db.database}`;

const waivioDb = mongoose.createConnection(URI);

waivioDb.on('error', console.error.bind(console, 'connection error:'));
waivioDb.once('open', () => {
  console.log(`${config.db.database} connected`);
});

waivioDb.on('close', () => console.log(`closed ${config.db.database}`));

module.exports = waivioDb;
