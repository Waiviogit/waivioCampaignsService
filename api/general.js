const { parseSwitcher, parseOrders } = require('parsers/mainParser');
const redisSetter = require('utilities/redis/redisSetter');
const redisGetter = require('utilities/redis/redisGetter');
const { nodeUrls: urls } = require('constants/appData');
const { Client } = require('@hiveio/dhive');
const axios = require('axios');
const _ = require('lodash');
const { socketHiveClient } = require('../utilities/webSoket/hiveSocket');

const nodeUrls = [
  // 'https://api.deathwing.me',
  // 'https://hived.emre.sh',
  // 'https://api.pharesim.me',
  'https://blocks.waivio.com',
  ...urls];

let CURRENT_NODE_URL = nodeUrls[0];

let hiveUrl = nodeUrls[0];

const getBlockNumberStream = async ({
  startFromBlock, startFromCurrent, loadBlock, redisTitle,
}) => {
  if (startFromCurrent) {
    const hive2 = new Client(CURRENT_NODE_URL, { timeout: 8000 });
    await loadNextBlock({
      startBlock: (
        await hive2.database.getDynamicGlobalProperties()).last_irreversible_block_num,
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
    console.error(error);
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
    const resp = await socketHiveClient.getBlock(blockNum);
    if (!resp.error) return { block: resp };
    const hive = new Client(currenturl);
    const block = await hive.database.call('get_block', [blockNum]);
    console.log();
    return { block };
  } catch (error) {
    return { error };
  }
};

const loadBlockRest = async (blockNum) => { // return true if block exist and parsed, else - false
  const block = [];

  console.log(`start loadBlock  REST${blockNum}`);
  const lastBlockNum = await redisGetter.getLastBlockNum('last_block_num');
  // const hive2 = new Client(nodeUrls, { failoverThreshold: 0, timeout: 8000 });
  // const currentBlock = await hive2.database.getDynamicGlobalProperties();
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
  await parseOrders(block);
  return true;
};

const getBlockREST = async (blockNum) => {
  try {
    const resp = await socketHiveClient.getOpsInBlock(blockNum);
    if (!resp.error) return { result: resp };
    const instance = axios.create();
    const result = await instance.post(
      CURRENT_NODE_URL,
      getOpsInBlockReqData(blockNum),
      // { timeout: 8000 },
    );
    console.log();
    return { result: _.get(result, 'data.result.ops') };
  } catch (error) {
    return { error };
  }
};

const changeNodeUrl = () => {
  const index = nodeUrls.indexOf(hiveUrl);

  hiveUrl = index === nodeUrls.length - 1 ? nodeUrls[0] : nodeUrls[index + 1];
  console.error(`Node URL was changed to ${hiveUrl}`);
};

const changeRestNodeUrl = () => {
  const index = nodeUrls.indexOf(CURRENT_NODE_URL);

  CURRENT_NODE_URL = index === nodeUrls.length - 1 ? nodeUrls[0] : nodeUrls[index + 1];
  console.error(`REST Node URL was changed to ${CURRENT_NODE_URL}`);
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
