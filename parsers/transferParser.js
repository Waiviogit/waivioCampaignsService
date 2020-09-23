const _ = require('lodash');
const { paymentsHelper, transferHelper } = require('utilities/helpers');
const { notificationsRequest } = require('utilities/requests');
const { userModel, paymentHistoryModel } = require('models');
const config = require('config');

const parse = async (data, transactionId) => {
  await parseCampaignsTransfer(data, transactionId);
};

/**
 *  Parse transfer operations
 *  user_reward => create payment history record about reward users review by sponsor
 * guest_reward  => create payment history record about reward demo users review by sponsor
 * user_to_guest_transfer => create payment history
 * record about transaction to demo user from steem(hive) user
 * demo_user_transfer => create payment history record
 * about transaction from demo user to steem(hive) user
 * @param amount {string}
 * @param to {string}
 * @param from {string}
 * @param transactionId {string}
 * @param memo {string | undefined | null}
 * @returns {Promise<void>}
 */
const parseCampaignsTransfer = async ({
  amount, to, from, memo,
}, transactionId) => {
  if (typeof amount === 'string' && amount.includes('HIVE')) {
    const memoJson = parseJson({ memo });
    let remaining = 0, payed = false;
    if (memoJson) {
      try {
        switch (memoJson.id) {
          case 'overpayment_refund':
            await transferHelper.overpaymentRefund({
              to, from: memoJson.from || from, amount, memoJson,
            });
            break;
          case 'user_reward':
            if (memoJson.app && memoJson.app === config.blackListApp) return;
            ({ remaining, payed } = await transferHelper.recountDebtAfterTransfer({
              guideName: from, userName: to, amount: parseFloat(amount), isGuest: false,
            }));
            await paymentsHelper.transfer({
              permlink: null, userName: to, sponsor: from, amount, transactionId, remaining, payed,
            });
            break;
          case 'guest_reward':
          case 'user_to_guest_transfer':
            await parseGuestTransfers({
              memoJson, to, from, amount,
            });
            break;
          case 'demo_user_transfer':
            if (_.get(memoJson, 'message.id') === 'overpayment_refund') {
              await transferHelper.overpaymentRefund({
                to: memoJson.to, from: memoJson.from, amount, memoJson: memoJson.message,
              });
              break;
            }
            await paymentHistoryModel.addPaymentHistory({
              userName: memoJson.from,
              type: memoJson.id,
              payable: amount.match(/.\d*.\d*/)[0],
              sponsor: from,
              memo: `Transfer to ${to}, memo: ${memoJson.message.toString()}`,
            });
            break;
        }
      } catch (error) {}
    }
  }
};

const parseJson = ({ memo }) => {
  try {
    return JSON.parse(memo);
  } catch (error) {
    return null;
  }
};

const parseGuestTransfers = async ({
  memoJson, to, from, amount,
}) => {
  let remaining = 0, payed = false, updated = false, result;
  const { user: demoUser } = await userModel.findOne(memoJson.to);

  if (to === process.env.WALLET_ACC_NAME && demoUser) {
    const blacklisted = memoJson.id === 'guest_reward'
      ? memoJson.app && memoJson.app === config.blackListApp
      : false;

    if (memoJson.id === 'guest_reward') {
      ({ remaining, payed } = await transferHelper.recountDebtAfterTransfer({
        guideName: from, userName: memoJson.to, amount: parseFloat(amount), isGuest: true,
      }));
      const { result: payment } = await paymentHistoryModel.find(
        { sponsor: from, userName: memoJson.to },
      );
      const record = _.find(payment, (doc) => _.isString(_.get(doc, 'details.transactionId')));
      if (record) {
        await paymentsHelper.updatePayment({
          amount: amount.match(/.\d*.\d*/)[0], payed, remaining, record,
        });
        updated = true;
      }
    }
    if (!updated) {
      ({ result } = await paymentHistoryModel.addPaymentHistory({
        userName: memoJson.to,
        remaining,
        payed,
        type: memoJson.id === 'guest_reward' && !blacklisted ? 'demo_debt' : 'user_to_guest_transfer',
        payable: amount.match(/.\d*.\d*/)[0],
        sponsor: from,
        memo: memoJson.message,
        owner_account: true,
      }));
    }
  }
};

module.exports = { parse };
