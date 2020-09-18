const _ = require('lodash');
const moment = require('moment');
const { blockTradesCredentials, dailyLimit } = require('constants/withdraw');
const { cryptoCoins } = require('constants/withdraw');
const { guestRequests, blocktradesRequests, currencyRequest } = require('utilities/requests');
const { getDemoDebtHistory } = require('utilities/operations/paymentHistory');
const usersHelper = require('./usersHelper');

exports.validateTransaction = async ({
  transactionData, userName, email, accessToken, onlyValidate,
}) => {
  if (!await guestRequests.validateUser(accessToken, userName)) {
    return { error: { status: 401, message: 'Invalid token' } };
  }
  const checkEmail = await usersHelper.validateEmail(email, userName);
  if (!checkEmail) {
    return { error: { status: 403, message: 'Invalid email' } };
  }
  const { result: wallet } = await blocktradesRequests.validateWallet(
    { crypto: cryptoCoins[transactionData.outputCoinType], address: transactionData.address },
  );
  if (!_.get(wallet, 'isValid')) return { error: { status: 403, message: 'Invalid wallet' } };

  const { payable } = await getDemoDebtHistory({ userName, limit: 1, skip: 0 });
  if (_.isNumber(payable) && payable < transactionData.amount) {
    return { error: { status: 403, message: 'Not enough balance' } };
  }
  return getDataForTransaction(transactionData, onlyValidate, checkEmail);
};

const getDataForTransaction = async (data, onlyValidate, checkEmail) => {
  const {
    result: session,
    error: sessionError,
  } = await blocktradesRequests.getSession(blockTradesCredentials);
  if (sessionError) return { error: { status: 403, message: 'Forbidden' } };

  const {
    result: transactions,
    error: transactionsError,
  } = await blocktradesRequests.getTransactions(session.token);
  if (transactionsError) return { error: { status: 403, message: 'Forbidden' } };

  const { usdCurrency } = await currencyRequest.getHiveCurrency();

  const reachLimit = await validateAmount({ amount: data.amount, transactions, usdCurrency });
  if (reachLimit) return { error: { status: 403, message: 'Reached global daily limit, please try tomorrow' } };
  if (onlyValidate) return { result: true };

  const { result: mapping, error: mappingError } = await getMappings(data.address, data.outputCoinType, data.inputCoinType, session.token);
  if (mappingError || !_.get(mapping, 'inputAddress')) return { error: { status: 403, message: 'Forbidden' } };

  if (data.amount <= (+_.get(mapping, 'flatTransactionFeeInInputCoinType', 0)) * 5) {
    return { error: { status: 403, message: `Blocktrades takes a commission of ${_.get(mapping, 'flatTransactionFeeInInputCoinType', 0)}, please send the amount not less than 5 times the commission` } };
  }

  const amount = data.amount - (+_.get(mapping, 'flatTransactionFeeInInputCoinType', 0));
  const { result: estimate, error: estimateError } = await blocktradesRequests.estimateOutput(
    { inputAmount: amount, inputCoinType: data.inputCoinType, outputCoinType: data.outputCoinType },
  );
  if (estimateError || !_.get(estimate, 'outputAmount')) return { error: { status: 403, message: 'Forbidden' } };

  return {
    amount: +_.get(estimate, 'outputAmount'),
    transaction: _.get(mapping, 'inputAddress'),
    commission: (+_.get(mapping, 'flatTransactionFeeInInputCoinType', 0)),
    usdValue: (data.amount * usdCurrency),
    checkEmail,
  };
};

const getMappings = async (address, outputCoin, inputCoin, token) => {
  const data = {
    allOrNothing: null,
    desiredOutputAmount: null,
    refundAddressNickname: null,
    inputCoinType: inputCoin,
    outputAddress: {
      address, memo: '',
    },
    outputCoinType: outputCoin,
    sessionToken: token,
  };
  return blocktradesRequests.mapping(data);
};

const validateAmount = async ({ amount, transactions, usdCurrency }) => {
  const todayTransactions = _.filter(transactions,
    (transaction) => transaction.inputFullyConfirmedTime > moment.utc().startOf('day').toDate());

  if (!todayTransactions.length) return false;

  const todayAmount = _.sumBy(todayTransactions, (doc) => +doc.inputUsdEquivalent);

  return !usdCurrency || todayAmount + (amount * usdCurrency) > dailyLimit;
};
