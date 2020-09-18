const axios = require('axios');
const { blocktradesApi } = require('constants/appData');


exports.estimateOutput = async ({ inputAmount, inputCoinType, outputCoinType }) => {
  try {
    const result = await axios.get(`${blocktradesApi.HOST}${blocktradesApi.ESTIMATE_OUTPUT}?inputAmount=${inputAmount}&inputCoinType=${inputCoinType}&outputCoinType=${outputCoinType}`);
    return { result: result.data };
  } catch (error) {
    return { error };
  }
};

exports.validateWallet = async ({ address, crypto }) => {
  try {
    const result = await axios.get(`${blocktradesApi.HOST}${blocktradesApi.WALLET}/${crypto}${blocktradesApi.WALLET_VALIDATE}?address=${address}`);
    return { result: result.data };
  } catch (error) {
    return { error };
  }
};

exports.getSession = async ({ email, password }) => {
  try {
    const result = await axios.post(`${blocktradesApi.HOST}${blocktradesApi.SESSION}`, { email, password });
    return { result: result.data };
  } catch (error) {
    console.error(error.message);
    return { error };
  }
};

exports.getTransactions = async (sessionToken) => {
  try {
    const result = await axios.get(`${blocktradesApi.HOST}${blocktradesApi.TRANSACTIONS}?sessionToken=${sessionToken}`);
    return { result: result.data };
  } catch (error) {
    console.error(error.message);
    return { error };
  }
};

exports.mapping = async (data) => {
  try {
    const result = await axios.post(`${blocktradesApi.HOST}${blocktradesApi.MAPPINGS}`, data);
    return { result: result.data };
  } catch (error) {
    console.error(error.message);
    return { error };
  }
};
