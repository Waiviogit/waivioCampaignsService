const config = require('./config');

const migration = {
  mongodb: {
    url: `mongodb://${config.db.host}:${config.db.port}/${config.db.database}`,
    databaseName: 'waivio',
    options: {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    },
  },

  migrationsDir: 'migrations',
  changelogCollectionName: 'changelog',
  migrationFileExtension: '.js',
  useFileHash: false,
};

module.exports = migration;
