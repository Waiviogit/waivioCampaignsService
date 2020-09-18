const { internalExchangeHelper } = require('utilities/helpers');

const parse = async (operations) => {
  for (const operation of operations) {
    switch (operation.type) {
      case 'fill_order_operation':
        await internalExchangeHelper.createExchangeOperation({
          data: operation.value,
          receiveString: 'open_pays',
          sellString: 'current_pays',
          type: 'fillOrder',
        });
        break;
      case 'limit_order_create_operation':
        await internalExchangeHelper.createExchangeOperation({
          data: operation.value,
          receiveString: 'min_to_receive',
          sellString: 'amount_to_sell',
          type: 'limitOrder',
        });
        break;
      case 'limit_order_cancel_operation':
        await internalExchangeHelper.cancelOrder(operation.value);
        break;
    }
  }
};

module.exports = { parse };
