const { parseSwitcher, parseOrders } = require('parsers/mainParser');
const redisSetter = require('utilities/redis/redisSetter');
const redisGetter = require('utilities/redis/redisGetter');
const { nodeUrls: urls } = require('constants/appData');
const { Client } = require('@hiveio/dhive');
const axios = require('axios');
const _ = require('lodash');
const { socketHiveClient } = require('../utilities/webSoket/hiveSocket');

const nodeUrls = [...urls];

let CURRENT_NODE_URL = nodeUrls[0];
let CURRENT_NODE_URL_REST = nodeUrls[1];
let errorCount = 0;

const getBlockNumberStream = async ({
  startFromBlock, startFromCurrent, loadBlock, redisTitle,
}) => {
  if (startFromCurrent) {
    const hive = new Client(CURRENT_NODE_URL);
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

const loadBlock = async (blockNum) => {
  const { block, error } = await getBlock(blockNum, CURRENT_NODE_URL);

  if (error) {
    errorCount++;
    if (errorCount > 5) process.exit();
    console.error(error.message);
    changeNodeUrl();
    return false;
  }

  if (block && (!block.transactions || !block.transactions[0])) {
    console.error(`EMPTY BLOCK: ${blockNum}`);
    return true;
  }
  if (block && block.transactions && block.transactions[0]) {
    console.time(block.transactions[0].block_num);
    await parseSwitcher(block.transactions);
    console.timeEnd(block.transactions[0].block_num);
    return true;
  } return false;
};

const getBlock = async (blockNum, currenturl) => {
  try {
    // const resp = await socketHiveClient.getBlock(blockNum);
    // if (!_.get(resp, 'error')) return { block: resp };
    const hive = new Client(currenturl, { timeout: 8000 });
    const block = await hive.database.call('get_block', [blockNum]);
    return { block };
  } catch (error) {
    return { error };
  }
};

const loadBlockRest = async (blockNum) => { // return true if block exist and parsed, else - false
  const block = [];

  const lastBlockNum = await redisGetter.getLastBlockNum('campaign_last_block_num');
  if (blockNum > (lastBlockNum - 30)) return false;
  const { result, error } = await getBlockREST(blockNum);

  const groupedOperations = _.groupBy(_.get(result, 'ops'), 'trx_id');
  _.forEach(Object.keys(groupedOperations), (id) => block.push(groupedOperations[id]));
  if (error) {
    console.error(error.message);
    changeRestNodeUrl();
    await loadBlockRest();
    return false;
  }
  if (!block.length) {
    console.error(`NO DATA FROM BLOCK BY REST: ${blockNum}`);
    return true;
  }
  console.time(`BLOCK OPS ${blockNum}`);
  await parseOrders(block);
  console.timeEnd(`BLOCK OPS ${blockNum}`);
  return true;
};

const getBlockREST = async (blockNum) => {
  try {
    // const resp = await socketHiveClient.getOpsInBlock(blockNum);
    // if (!_.get(resp, 'error')) return { result: resp };

    const result = await axios.post(
      CURRENT_NODE_URL_REST,
      getOpsInBlockReqData(blockNum),
    );
    console.log();
    return { result: _.get(result, 'data.result') };
  } catch (error) {
    return { error };
  }
};

const changeNodeUrl = () => {
  const index = nodeUrls.indexOf(CURRENT_NODE_URL);

  CURRENT_NODE_URL = index === nodeUrls.length - 1 ? nodeUrls[0] : nodeUrls[index + 1];
  console.error(`Node URL was changed to ${CURRENT_NODE_URL}`);
};

const changeRestNodeUrl = () => {
  const index = nodeUrls.indexOf(CURRENT_NODE_URL_REST);

  CURRENT_NODE_URL_REST = index === nodeUrls.length - 1 ? nodeUrls[0] : nodeUrls[index + 1];
  console.error(`REST Node URL was changed to ${CURRENT_NODE_URL_REST}`);
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
