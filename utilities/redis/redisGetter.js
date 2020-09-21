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

module.exports = { getLastBlockNum, getTTLData, getTTLCampaignsData };
