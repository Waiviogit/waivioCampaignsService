const _ = require('lodash');

module.exports = {
  async up(db) {
    await db.collection('payment_histories').find({}, { amount: 1, details: 1, payment: 1 })
      .forEach((doc) => {
        db.collection('payment_histories').updateOne(
          { _id: doc._id },
          [{
            $addFields: {
              amount: { $toDecimal: _.get(doc, 'amount', 0) },
              'details.hiveCurrency': { $toDecimal: _.get(doc, 'details.hiveCurrency', 0) },
              'details.payableInDollars': { $toDecimal: _.get(doc, 'details.payableInDollars', 0) },
              'details.remaining': { $toDecimal: _.get(doc, 'details.remaining', 0) },
              'payment.details': { $toDecimal: _.get(doc, 'payment.details.payableInDollars', 0) },
            },
          }],
        );
      });
  },

  async down(db) {
    await db.collection('payment_histories').find({}, { amount: 1, details: 1, payment: 1 })
      .forEach((doc) => {
        db.collection('payment_histories').updateOne(
          { _id: doc._id },
          [{
            $addFields: {
              amount: { $toDouble: _.get(doc, 'amount', 0) },
              'details.hiveCurrency': { $toDouble: _.get(doc, 'details.hiveCurrency', 0) },
              'details.payableInDollars': { $toDouble: _.get(doc, 'details.payableInDollars', 0) },
              'details.remaining': { $toDouble: _.get(doc, 'details.remaining', 0) },
              'payment.details': { $toDouble: _.get(doc, 'payment.details.payableInDollars', 0) },
            },
          }],
        );
      });
  },
};
