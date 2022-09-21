const { removeVotes } = require('./removeVotesOnRejected');

(async () => {
  await removeVotes();
  process.exit();
})();
