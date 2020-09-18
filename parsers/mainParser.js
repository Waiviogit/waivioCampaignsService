const _ = require('lodash');
const {
  commentParser, customJsonParser, transferParser,
  accountUpdateParser, ordersParser, voteParser,
} = require('parsers');

const parseSwitcher = async (transactions) => {
  const votesOps = [];
  for (const transaction of transactions) {
    if (transaction && transaction.operations && transaction.operations[0]) {
      for (const operation of transaction.operations) {
        try {
          switch (operation[0]) {
            case 'vote':
              votesOps.push(operation[1]);
              break;
            case 'comment':
              await commentParser.parse(operation[1], transaction.operations[1]);
              break;
            case 'transfer':
              await transferParser.parse(operation[1], transaction.transaction_id);
              break;
            case 'custom_json':
              await customJsonParser.parse(operation[1]);
              break;
            case 'account_update':
              await accountUpdateParser.parse(operation[1]);
              break;
          }
        } catch (error) {
          console.log(error);
        }
      }
    }
  }
  await voteParser.parse(votesOps);
};

const parseOrders = async (operations) => {
  let orders = [];
  for (let operation of operations) {
    operation = _.map(operation, (ops) => {
      ops.op.value.timestamp = ops.timestamp;
      return ops.op;
    });
    try {
      switch (operation[0].type) {
        case 'fill_order_operation':
          orders = _.concat(orders, operation);
          break;
        case 'limit_order_create_operation':
          orders = _.concat(orders, operation);
          break;
        case 'limit_order_cancel_operation':
          orders = _.concat(orders, operation);
          break;
      }
    } catch (error) {
      console.log(error);
    }
  }
  if (orders.length) {
    await ordersParser.parse(orders);
  }
};

module.exports = {
  parseSwitcher, parseOrders,
};
