const { lastBlockClient, demoPosts, campaigns } = require('./redis');

const getLastBlockNum = async (data) => {
  const num = await lastBlockClient.getAsync(data);

  return num ? parseInt(num, 10) : process.env.START_FROM_BLOCK || 29937113;
};

const getTTLData = async (key) => {
  try {
    const data = await demoPosts.getAsync(key);
    return { result: data };
  } catch (error) {
    return { error };
  }
};

const getTTLCampaignsData = async (key) => {
  try {
    const data = await campaigns.getAsync(key);
    return { result: data };
  } catch (error) {
    return { error };
  }
};

const getHashAll = async (key, client = lastBlockClient) => client.hgetallAsync(key);

const smembers = async (key, client = demoPosts) => client.smembersAsync(key);

const zrevrange = async ({
  key, start, end, client = demoPosts,
}) => {
  try {
    return { result: await client.zrevrangeAsync(key, start, end) };
  } catch (error) {
    return { error };
  }
};

const zrevrangebyscore = async ({
  key, max, min, client = demoPosts,
}) => {
  try {
    return { result: await client.zrevrangebyscoreAsync(key, max, min) };
  } catch (error) {
    return { error };
  }
};

const sismember = async ({ key, member, client = demoPosts }) => client.sismemberAsync(key, member);

const get = async ({ key, client = lastBlockClient }) => {
  try {
    return client.getAsync(key);
  } catch (error) {
    return '';
  }
};

module.exports = {
  getTTLCampaignsData,
  zrevrangebyscore,
  getLastBlockNum,
  getTTLData,
  getHashAll,
  zrevrange,
  smembers,
  sismember,
  get,
};
