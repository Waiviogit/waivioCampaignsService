// const campaignModel = require('models/campaignModel');
//
// const parseRewards = async (post, metadata) => {
//   switch (metadata.waivioRewards.type) {
//     case 'waivio_assign_campaign':
//       await campaignModel.assignObject({
//         campaign_permlink: post.parent_permlink,
//         reservation_permlink: post.permlink,
//         user_name: post.author,
//         approved_object: metadata.waivioRewards.approved_object,
//         expired: metadata.expired,
//       });
//       break;
//     case 'waivio_reject_object_campaign':
//       await campaignModel.rejectObject({
//         campaign_permlink: post.parent_permlink,
//         reservation_permlink: metadata.waivioRewards.reservation_permlink,
//         unreservation_permlink: post.permlink,
//         user_name: post.author,
//       });
//       break;
//     case 'waivio_activate_campaign':
//       await campaignModel.activateCampaign(
//         metadata.waivioRewards.campaign_id, post.author, post.permlink,
//       );
//       break;
//     case 'waivio_stop_campaign':
//       await campaignModel.inactivateCampaign(
//         { campaign_permlink: post.parent_permlink, guide_name: post.author, permlink: post.permlink },
//       );
//       break;
//   }
// };
//
// module.exports = {
//   parseRewards,
// };
