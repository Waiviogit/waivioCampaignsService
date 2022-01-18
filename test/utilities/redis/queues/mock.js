const {
  faker,
} = require('test/testHelper');

exports.mockDeleteQueueData = ({ campaignId, reservation_permlink } = {}) => ({
  campaignId: campaignId || faker.random.string(),
  reservation_permlink: reservation_permlink || faker.random.string(),
});
