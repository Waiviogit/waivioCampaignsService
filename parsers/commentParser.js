const _ = require('lodash');
const {
  commentParsers: {
    reduceReward, rejectReview, restoreReview, reservationOps, campaignActivation, raiseReward,
  },
} = require('utilities/operations/parsers');
const { paymentsHelper, usersHelper } = require('utilities/helpers');
const { notificationsRequest } = require('utilities/requests');
const redisSetter = require('utilities/redis/redisSetter');
const { hiveClient, hiveOperations } = require('utilities/hiveApi');

const parse = async (post, opts) => {
  const beneficiaries = _.get(opts, '[1].extensions[0][1].beneficiaries', null);
  const metadata = post.json_metadata ? jsonParse(post) : null;
  const app = metadata && metadata.app ? metadata.app : null;

  await parseReviews(post, metadata, app, beneficiaries);

  if (_.has(metadata, 'waivioRewards')) await parseActions(post, metadata, app);
  if (_.has(metadata, 'comment.userId') && post.parent_author === '') {
    await redisSetter.setDemoPost({ author: post.author, permlink: post.permlink });
  }
};

const jsonParse = (post) => {
  try {
    return JSON.parse(post.json_metadata);
  } catch (error) {
    return null;
  }
};

/**
 * Check for guest user, and set post author, then if post
 * has field 'wobj' in metadata, find active campaign with this wobj
 * check for exist reservation from current user, and if all is OK,
 * create review, add sponsors debt and mark users reservation as completed
 * @param post {Object}
 * @param metadata {object | null}
 * @param app {string | null}
 * @param beneficiaries {[Object] | null}
 * @returns {Promise<void>}
 */
const parseReviews = async (post, metadata, app, beneficiaries) => {
  let botName, postAuthor;

  if (_.get(metadata, 'comment.userId')) {
    postAuthor = metadata.comment.userId;
    botName = post.author;
  } else postAuthor = post.author;

  if (metadata && metadata.wobj) {
    const objects = _.map(metadata.wobj.wobjects, 'author_permlink');
    let campaigns = await paymentsHelper.findReviewCampaigns({ userName: postAuthor, objects });

    if (!_.isEmpty(campaigns)) {
      campaigns = await usersHelper.validateReview(metadata, postAuthor, campaigns);
      if (campaigns.length && !beneficiaries) {
        const hivePost = await hiveClient.execute(
          hiveOperations.getPostInfo, { author: post.author, permlink: post.permlink },
        );
        beneficiaries = _.get(hivePost, 'beneficiaries', []);
      }
      await paymentsHelper.createReview({
        campaigns,
        objects,
        app,
        permlink: post.permlink,
        title: post.title,
        beneficiaries,
        owner_account: botName,
        images: _.get(metadata, 'image', []),
        host: _.get(metadata, 'host', null),
      });
    }
  }
};

/**
 *  Switch campaigns actions from flag in comment metadata
 *  waivio_assign_campaign => assigned user at campaign and set data to redis
 *  waivio_reject_object_campaign => unassigned user at campaign and delete data from redis
 *  waivio_activate_campaign => activate campaign
 *  waivio_stop_campaign => deactivate campaign
 * @param post
 * @param metadata
 * @param app
 * @returns {Promise<void>}
 */
const parseActions = async (post, metadata, app) => {
  const postAuthor = _.get(metadata, 'comment.userId') ? metadata.comment.userId : post.author;

  switch (metadata.waivioRewards.type) {
    case 'waivio_assign_campaign':
      await reservationOps.assign({
        campaign_permlink: post.parent_permlink,
        reservation_permlink: post.permlink,
        user_name: postAuthor,
        root_name: post.author,
        approved_object: metadata.waivioRewards.approved_object,
        currencyId: metadata.waivioRewards.currencyId,
        referral_account: app,
        expired: metadata.expired,
      });
      break;
    case 'waivio_reject_object_campaign':
      await reservationOps.reject({
        campaign_permlink: post.parent_permlink,
        reservation_permlink: metadata.waivioRewards.reservation_permlink,
        unreservation_permlink: post.permlink,
        user_name: postAuthor,
      });
      break;
    case 'reject_reservation_by_guide':
      await rejectReview({
        user: post.parent_author,
        parent_permlink: post.parent_permlink,
        guideName: post.author,
        permlink: post.permlink,
      });
      break;
    case 'restore_reservation_by_guide':
      await restoreReview({
        user: post.parent_author,
        parentPermlink: post.parent_permlink,
        guideName: post.author,
        permlink: post.permlink,
      });
      break;
    case 'waivio_activate_campaign':
      await campaignActivation.activate(
        metadata.waivioRewards.campaign_id, postAuthor, post.permlink,
      );
      await notificationsRequest.activateCampaign(metadata.waivioRewards.campaign_id);
      break;
    case 'waivio_raise_review_reward':
      await raiseReward({
        user: post.parent_author,
        parentPermlink: post.parent_permlink,
        activationPermlink: metadata.waivioRewards.activationPermlink,
        guideName: post.author,
        riseAmount: metadata.waivioRewards.riseAmount,
        permlink: post.permlink,
      });
      break;
    case 'waivio_reduce_review_reward':
      if (post.parent_author !== post.author) return;
      await reduceReward({
        parentPermlink: post.parent_permlink,
        activationPermlink: metadata.waivioRewards.activationPermlink,
        userName: post.author,
        reduceAmount: metadata.waivioRewards.reduceAmount,
        permlink: post.permlink,
      });
      break;
    case 'waivio_stop_campaign':
      await campaignActivation.inactivate({
        campaign_permlink: post.parent_permlink,
        guide_name: postAuthor,
        permlink: post.permlink,
      });
      break;
  }
};

module.exports = { parse };
