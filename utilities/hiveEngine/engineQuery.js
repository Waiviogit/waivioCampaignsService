const axios = require('axios');
const _ = require('lodash');
const redisGetter = require('utilities/redis/redisGetter');
const jsonHelper = require('utilities/helpers/jsonHelper');
const { HIVE_ENGINE_NODES } = require('constants/hiveEngine');

const ENGINE_NODES_LIST = 'engine_nodes_list';

const getNewNodeUrl = (hostUrl, nodes) => {
  const index = hostUrl ? nodes.indexOf(hostUrl) : 0;

  return index === nodes.length - 1
    ? nodes[0]
    : nodes[index + 1];
};

const engineQuery = async ({
  hostUrl,
  method = 'find',
  params,
  endpoint = '/contracts',
  id = 'ssc-mainnet-hive',
}) => {
  try {
    const instance = axios.create();
    const resp = await instance.post(
      `${hostUrl}${endpoint}`,
      {
        jsonrpc: '2.0',
        method,
        params,
        id,
      }, {
        timeout: 5000,
      },
    );
    return _.get(resp, 'data.result');
  } catch (error) {
    return { error };
  }
};

const engineQueryRecursive = async ({
  hostUrl,
  method,
  params,
  endpoint,
  id,
  attempts,
  nodes,
}) => {
  const response = await engineQuery({
    hostUrl,
    method,
    params,
    endpoint,
    id,
  });
  if (_.has(response, 'error')) {
    if (attempts <= 0) return response;
    return engineQueryRecursive({
      hostUrl: getNewNodeUrl(hostUrl, nodes),
      method,
      params,
      endpoint,
      id,
      attempts: attempts - 1,
      nodes,
    });
  }
  return response;
};

const getEngineNodes = async () => {

  return HIVE_ENGINE_NODES;
  // const nodesString = await redisGetter.get({ key: ENGINE_NODES_LIST });
  // if (!nodesString) return HIVE_ENGINE_NODES;
  //
  // return jsonHelper.parseJson(nodesString, HIVE_ENGINE_NODES);
};

const engineProxy = async ({
  method,
  params,
  endpoint,
  id,
}) => {
  const nodes = await getEngineNodes();

  return engineQueryRecursive({
    hostUrl: _.sample(nodes),
    attempts: nodes.length,
    method,
    params,
    endpoint,
    id,
    nodes,
  });
};

module.exports = {
  engineProxy,
};
