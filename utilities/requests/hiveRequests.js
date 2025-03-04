const axios = require('axios');
const _ = require('lodash');
const chainTypes = require('@hiveio/hive-js/lib/auth/serializer/src/ChainTypes');
const makeBitMaskFilter = require('@hiveio/hive-js/lib/auth/serializer/src/makeBitMaskFilter');
const { socketHiveClient, HIVE_SOCKET_ERR } = require('../webSoket/hiveSocket');

const op = chainTypes.operations;
const historyFilter = makeBitMaskFilter([
  op.transfer,
  op.transfer_to_vesting,
  op.claim_reward_balance,
  op.transfer_to_savings,
  op.transfer_from_savings,
  op.limit_order_create,
  op.limit_order_cancel,
  op.fill_order,
  op.proposal_pay,
  op.withdraw_vesting,
  op.fill_vesting_withdraw,
  op.set_withdraw_vesting_route,
  op.fill_collateralized_convert_request,
  op.collateralized_convert,
  op.convert,
  op.fill_convert_request,
  op.delegate_vesting_shares,
  op.interest,
  op.fill_transfer_from_savings,
  op.cancel_transfer_from_savings,
  op.transfer_to_vesting_completed,
]);

// so far only api.hive.blog returns no error history on large accounts
// supposed it has config on node to process all data at once
const hiveUrl = 'https://api.hive.blog';

exports.getTransactionsHistory = async (name) => {
  try {
    const result = await axios.post(hiveUrl, {
      jsonrpc: '2.0',
      method: 'call',
      params: [
        'condenser_api',
        'get_state',
        [`/@${name}/transfers`],
      ],
    });
    return { result: result.data.result };
  } catch (error) {
    return { error };
  }
};

const getProcessHistorySocket = (result) => {
  if (_.get(result, 'error') && _.get(result, 'error.data.message') === 'Assert Exception') {
    const next = _.get(result, 'error.data.stack[0].data.sequence');
    return { next, result: [] };
  }
  return { result };
};

exports.getAccountHistory = async (name, id, limit) => {
  try {
    const socketResp = await socketHiveClient.getAccountHistory({
      name, id, limit, filterLow: historyFilter[0], filterHigh: historyFilter[1],
    });
    if (
      !_.get(socketResp, 'error') || !_.includes(Object.values(HIVE_SOCKET_ERR), _.get(socketResp, 'error.message'))
    ) {
      return getProcessHistorySocket(socketResp);
    }

    const result = await axios.post(hiveUrl, {
      id: 0,
      jsonrpc: '2.0',
      method: 'condenser_api.get_account_history',
      params: [
        name,
        id,
        limit,
        historyFilter[0],
        historyFilter[1],
      ],
    });
    if (result.data.error && result.data.error.data.message === 'Assert Exception') {
      const next = _.get(result, 'data.error.data.stack[0].data.sequence');
      return { next, result: [] };
    }
    return { result: result.data.result };
  } catch (error) {
    return { error };
  }
};
