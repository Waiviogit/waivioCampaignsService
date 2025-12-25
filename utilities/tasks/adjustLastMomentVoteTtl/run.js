const adjustLastMomentVoteTtl = require('./adjustLastMomentVoteTtl');

(async () => {
  await adjustLastMomentVoteTtl();
  process.exit();
})();
