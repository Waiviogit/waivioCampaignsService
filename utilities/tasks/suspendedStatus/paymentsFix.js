const _ = require('lodash');
const { PaymentHistory } = require('database').models;

module.exports = async () => {
  const histories = await PaymentHistory.aggregate([
    { $match: { type: { $in: ['transfer'] } } },
    { $group: { _id: '$sponsor' } }]);
  for (const name of histories) {
    await fixPayments(name._id);
  }
};

const fixPayments = async (guide) => {
  const payments = await PaymentHistory.find({ sponsor: guide, type: { $nin: ['user_to_guest_transfer', 'demo_post', 'demo_user_transfer'] } }).lean();
  const grouped = _.groupBy(payments, 'userName');
  for (const user of Object.keys(grouped)) {
    let transfers = _.filter(grouped[user], (payment) => _.includes(['demo_debt', 'transfer'], payment.type));
    let debts = _.filter(grouped[user], (payment) => !_.includes(['demo_debt', 'transfer'], payment.type));
    let transferSum = _.round(_.sumBy(transfers, 'amount'), 3);
    const debtSum = _.round(_.sumBy(debts, 'amount'), 3);
    transfers = _.sortBy(transfers, 'createdAt');
    debts = _.sortBy(debts, 'createdAt');
    if (transferSum === debtSum) {
      await PaymentHistory.updateMany({ _id: { $in: _.map(transfers, '_id') } }, { payed: true, 'details.remaining': 0 });
      await PaymentHistory.updateMany({ _id: { $in: _.map(debts, '_id') } }, { payed: true });
    } if (transferSum > debtSum) {
      await PaymentHistory.updateMany({ _id: { $in: _.map(debts, '_id') } }, { payed: true });

      const lastTransfer = transfers.pop();
      await PaymentHistory.updateMany({ _id: { $in: _.map(transfers, '_id') } }, { payed: true, 'details.remaining': 0 });
      await PaymentHistory.updateMany({ _id: lastTransfer._id }, { payed: false, 'details.remaining': _.round(transferSum - debtSum, 3) });
    } if (transferSum < debtSum) {
      const payed = [];
      for (const payment of debts) {
        if (transferSum < payment.amount) break;
        await PaymentHistory.updateOne({ _id: payment._id }, { payed: true });
        payed.push(payment._id);
        transferSum -= payment.amount;
      }
      const notPayedDebts = _.filter(debts, (debt) => !_.includes(payed, debt._id));
      await PaymentHistory.updateMany({ _id: { $in: _.map(notPayedDebts, '_id') } }, { payed: false });
      if (transfers.length) {
        const lastTransfer = transfers.pop();
        await PaymentHistory.updateMany({ _id: { $in: _.map(transfers, '_id') } }, { payed: true, 'details.remaining': 0 });
        await PaymentHistory.updateMany({ _id: lastTransfer._id }, { payed: false, 'details.remaining': transferSum });
      }
    }
  }
};
