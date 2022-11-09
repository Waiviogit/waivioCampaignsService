const _ = require('lodash');
const { paymentHistoryModel } = require('models');
const { PAYMENT_HISTORIES_TYPES } = require('constants/constants');
const { hiveOperations } = require('utilities/hiveApi');

exports.expirePendingTransfer = async (id) => {
  const { result } = await paymentHistoryModel.findOne({ _id: id });
  if (_.get(result, 'details.transactionId')) {
    await paymentHistoryModel.deleteMany({ _id: id });
  }
};

/**
 * Check for exist payout from review, if it exist create record with type demo post in DB
 * @param author {string}
 * @param permlink {string}
 * @returns {Promise<void>}
 */
exports.expireDemoPost = async ({ author, permlink }) => {
  const post = await hiveOperations.getPostInfo({ author, permlink });
  if (!post) return;
  const metadata = JSON.parse(post.json_metadata);
  const payoutPercent = _.get(post, 'percent_steem_dollars', post.percent_hive_dollars);
  const authorPayout = parseFloat(post.total_payout_value);
  const curatorPayout = parseFloat(post.curator_payout_value);
  const totalPayout = payoutPercent
    ? curatorPayout + (authorPayout / (payoutPercent / 10000))
    : curatorPayout * 2;
  const steemAmount = await hiveOperations.getPostAuthorReward(
    { reward_price: totalPayout },
  );

  if (steemAmount > 0 && _.find(post.beneficiaries, { account: process.env.POWER_ACC_NAME })) {
    let reward = steemAmount / 2;
    if (_.get(post, 'beneficiaries', []).length) {
      const hPower = _.find(post.beneficiaries,
        (bnf) => bnf.account === process.env.POWER_ACC_NAME);
      if (hPower) reward = (steemAmount / 2) * (hPower.weight / 10000);
      else reward = (steemAmount / 2) * (1 - (_.sumBy(post.beneficiaries, 'weight') / 10000));
    }

    const { result: payment } = await paymentHistoryModel.findOne({
      userName: metadata.comment.userId, sponsor: author, type: 'demo_post', 'details.post_permlink': permlink,
    });
    if (payment) return;
    await paymentHistoryModel.addPaymentHistory({
      post,
      review_permlink: permlink,
      payable: reward,
      userName: metadata.comment.userId,
      sponsor: author,
      type: PAYMENT_HISTORIES_TYPES.DEMO_POST,
      owner_account: true,
    });
  }
};
