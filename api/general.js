const { parseSwitcher, parseOrders } = require('parsers/mainParser');
const redisSetter = require('utilities/redis/redisSetter');
const redisGetter = require('utilities/redis/redisGetter');
const { nodeUrls } = require('constants/appData');
const { Client } = require('@hiveio/dhive');
const axios = require('axios');
const _ = require('lodash');

const hive = new Client(nodeUrls[0]);

const getBlockNumberStream = async ({
  startFromBlock, startFromCurrent, loadBlock, redisTitle,
}) => {
  if (startFromCurrent) {
    await loadNextBlock({
      startBlock: (
        await hive.database.getDynamicGlobalProperties()).last_irreversible_block_num,
      loadBlock,
      redisTitle,
    });
  } else if (startFromBlock && Number.isInteger(startFromBlock)) {
    await loadNextBlock({ startBlock: startFromBlock, loadBlock, redisTitle });
  } else {
    await loadNextBlock({ loadBlock, redisTitle });
  }
  return true;
};

const loadNextBlock = async ({ startBlock, loadBlock, redisTitle }) => {
  let lastBlockNum;

  if (startBlock) {
    lastBlockNum = startBlock;
  } else {
    lastBlockNum = await redisGetter.getLastBlockNum(redisTitle);
  }
  process.env.BLOCK_NUM = lastBlockNum;
  const loadResult = await loadBlock(lastBlockNum);

  if (loadResult) {
    await redisSetter.setLastBlockNum(lastBlockNum + 1, redisTitle);
    await loadNextBlock({ loadBlock, redisTitle });
  } else {
    await setTimeout(async () => loadNextBlock({ loadBlock, redisTitle }), 2000);
  }
};

const loadBlock = async (block_num) => {
  let block;

  try {
    block = await hive.database.getBlock(block_num);
  } catch (error) {
    console.error(error);
    changeNodeUrl();
    return false;
  }
  if (block && (!block.transactions || !block.transactions[0])) {
    console.error(`EMPTY BLOCK: ${block_num}`);
    return true;
  }
  if (block && block.transactions && block.transactions[0]) {
    console.time(block.transactions[0].block_num);
    await parseSwitcher(block.transactions);
    console.timeEnd(block.transactions[0].block_num);
    return true;
  } return false;
};

const loadBlockRest = async (block_num) => { // return true if block exist and parsed, else - false
  const block = [];
  try {
    const currentBlock = await hive.database.getDynamicGlobalProperties();
    if (block_num > currentBlock.last_irreversible_block_num) return false;
    const result = await axios.post(nodeUrls[0], getOpsInBlockReqData(block_num));

    if (!_.get(result, 'data.result.ops')) throw ({ message: 'No result from request' });
    const groupedOperations = _.groupBy(result.data.result.ops, 'trx_id');
    _.forEach(Object.keys(groupedOperations), (id) => block.push(groupedOperations[id]));
  } catch (error) {
    console.error(error.message);
    await loadBlockRest();
    return false;
  }
  if (!block.length) {
    console.error(`NO DATA FROM BLOCK BY REST: ${block_num}`);
    return true;
  }
  await parseOrders(block);
  return true;
};

const changeNodeUrl = () => {
  const index = nodeUrls.indexOf(hive.address);

  hive.address = index === nodeUrls.length - 1 ? nodeUrls[0] : nodeUrls[index + 1];
  console.error(`Node URL was changed to ${hive.address}`);
};

const getOpsInBlockReqData = (blockNum) => ({
  jsonrpc: '2.0',
  method: 'account_history_api.get_ops_in_block',
  params: {
    block_num: blockNum,
    only_virtual: false,
  },
  id: 1,
});

module.exports = {
  getBlockNumberStream, loadBlock, loadBlockRest,
};
