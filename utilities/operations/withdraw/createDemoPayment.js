const { paymentHistoryModel } = require('models');

module.exports = async (params) => paymentHistoryModel.addPaymentHistory(params);
