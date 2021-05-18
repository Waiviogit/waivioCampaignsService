const { paymentHistoryModel } = require('models');

const addDetails = async () => {
  const { result } = await paymentHistoryModel.find({ type: 'demo_user_transfer', sponsor: { $in: ['waivio.hive', 'waiviobank'] } });
  for (const payment of result) {
    const commaIndex = payment.memo.indexOf(',');
    const transferTo = payment.memo.substring(12, commaIndex);

    await paymentHistoryModel.updateOne({ _id: payment._id }, { sponsor: transferTo });
  }
  console.info('Task finished');
};

module.exports = { addDetails };
