const { api } = require('api');

const runStream = async () => {
  try {
    const transactionStatus = await api.getBlockNumberStream({
      startFromCurrent: false,
      loadBlock: api.loadBlock,
      redisTitle: 'campaign_last_block_num',
    });

    if (!transactionStatus) console.log('Data is incorrect or stream is already started!');
    else console.log('Stream started!');
  } catch (e) {
    console.error(e);
  }
};

const runStreamRest = async () => {
  try {
    const transactionStatus = await api.getBlockNumberStream({
      startFromCurrent: false,
      loadBlock: api.loadBlockRest,
      redisTitle: 'campaign_last_block_rest_num',
    });

    if (!transactionStatus) console.log('Data is incorrect or stream is already started!');
    else console.log('REST stream started!');
  } catch (e) {
    console.error(e);
  }
};

module.exports = {
  runStream, runStreamRest,
};
