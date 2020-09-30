const {
  campaignsController,
  payablesController,
  matchBotController,
  demoUserController,
  blackListsController,
  withdrawController,
  mailerController,
  referralsController,
} = require('controllers');

const { guestRequests } = require('utilities/requests');
const { Router } = require('express');

const campaignsRoutes = new Router();
const withdrawRoutes = new Router();
const mailerRoutes = new Router();
const referralRoutes = new Router();
const apiRoutes = new Router();

apiRoutes.use('/campaigns-api/withdraw', withdrawRoutes);
apiRoutes.use('/campaigns-api/mailer', mailerRoutes);
apiRoutes.use('/campaigns-api', campaignsRoutes);
apiRoutes.use('/campaigns-api/referrals', referralRoutes);

campaignsRoutes.route('/campaigns/dashboard/:guide_name').get(campaignsController.campaignsDashboard);
campaignsRoutes.route('/campaigns/eligible').post(campaignsController.eligibleCampaigns);
campaignsRoutes.route('/campaigns/reserved').post(campaignsController.reservedCampaigns);
campaignsRoutes.route('/campaigns/:guideName/blacklist').get(blackListsController.show);
campaignsRoutes.route('/campaigns/:campaign_id').delete(campaignsController.destroy);
campaignsRoutes.route('/statistics').get(campaignsController.getCampaignsStatistic);
campaignsRoutes.route('/statistics').post(campaignsController.getCampaignsStatistic);
campaignsRoutes.route('/campaigns/all').post(campaignsController.allCampaigns);
campaignsRoutes.route('/campaign/:campaign_id').get(campaignsController.show);
campaignsRoutes.route('/campaigns/history').post(campaignsController.history);
campaignsRoutes.route('/create_campaign').post(campaignsController.create);
campaignsRoutes.route('/rewards/:userName').get(campaignsController.userRewards);

campaignsRoutes.route('/validate_reject_reservation').post(campaignsController.validateRejectAssignCampaign);
campaignsRoutes.route('/validate_activation').post(campaignsController.validateActivationCampaign);
campaignsRoutes.route('/validate_reservation').post(campaignsController.validateAssignCampaign);
campaignsRoutes.route('/validate_inactivation').post(campaignsController.validateStopCampaign);

campaignsRoutes.route('/payments/set-pending-transfer').post(payablesController.setPendingTransfer);
campaignsRoutes.route('/payments/transfers_history').get(payablesController.transfersHistory);
campaignsRoutes.route('/payments/demo_payables').get(payablesController.demoDeptHistory);
campaignsRoutes.route('/payments/payables').post(payablesController.payableHistory);
campaignsRoutes.route('/payments/report').post(payablesController.report);

campaignsRoutes.route('/guest/transfer').post(guestRequests.validateAuthToken, demoUserController.transfer);
campaignsRoutes.route('/match_bots').get(matchBotController.sponsorMatchBots);

withdrawRoutes.route('/get-withdraw-data').get(withdrawController.getTransactionStatus);
withdrawRoutes.route('/validate-crypto-wallet').get(withdrawController.validateWallet);
withdrawRoutes.route('/estimate-output-amount').get(withdrawController.estimateAmount);
withdrawRoutes.route('/confirm-transaction').get(withdrawController.finalConfirm);
withdrawRoutes.route('/create-demo-payment').post(withdrawController.demoPayment);

mailerRoutes.route('/confirm-email-in-transaction').get(mailerController.confirmEmailInTransaction);
mailerRoutes.route('/confirm-email-response').get(mailerController.confirmEmailResponse);
mailerRoutes.route('/confirm-email-request').post(mailerController.confirmEmailRequest);

referralRoutes.route('/details').get(referralsController.details);
referralRoutes.route('/status').get(referralsController.status);
referralRoutes.route('/check-user-app-blacklist').get(referralsController.blackList);

module.exports = apiRoutes;
