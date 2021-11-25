const { preValidationHelper } = require('utilities/helpers');
const { destroyCampaign } = require('models/campaignModel');
const validators = require('controllers/validators');
const {
  renderCustomError,
  renderNotFound,
  renderSuccess,
  renderError,
} = require('concerns/renderConcern');
const {
  getReservedCampaignsCount,
  getCampaignsByWobject,
  getEligibleCampaigns,
  getReservedCampaigns,
  getDataForFirstLoad,
  getAllCampaigns,
  createCampaign,
  checkingReview,
  getUserRewards,
  getDashboard,
  getCampaign,
  getHistory,
} = require('utilities/operations').campaigns;

const reservedCampaigns = async (req, res) => {
  const { params, validationError } = validators.validate(
    Object.assign(req.body, { appName: req.headers.app, locale: req.headers.locale }),
    validators.campaigns.campaignsSchema,
  );

  if (validationError) return renderError(res, validationError);
  const {
    // eslint-disable-next-line camelcase
    campaigns, campaigns_types, hasMore, sponsors, radius, error,
  } = await getReservedCampaigns(params);

  if (error) renderError(res, { error: error.message });
  else {
    renderSuccess(res, {
      campaigns, campaigns_types, hasMore, sponsors, radius,
    });
  }
};

const reservedCampaignsCount = async (req, res) => {
  const { params, validationError } = validators.validate(
    req.query,
    validators.campaigns.reservedCountSchema,
  );

  if (validationError) return renderError(res, validationError);
  const { count, error } = await getReservedCampaignsCount(params);

  if (error) renderError(res, { error: error.message });

  renderSuccess(res, { count });
};

const allCampaigns = async (req, res) => {
  const { params, validationError } = validators.validate(
    Object.assign(req.body, { appName: req.headers.app, locale: req.headers.locale }),
    validators.campaigns.campaignsSchema,
  );
  if (validationError) return renderError(res, validationError);
  const {
    // eslint-disable-next-line camelcase
    campaigns, campaigns_types, hasMore, sponsors, radius, error,
  } = await getAllCampaigns(params);
  if (error) renderError(res, { error: error.message });
  else {
    renderSuccess(res, {
      campaigns, campaigns_types, hasMore, sponsors, radius,
    });
  }
};

const eligibleCampaigns = async (req, res) => {
  const { params, validationError } = validators.validate(
    Object.assign(req.body, { appName: req.headers.app, locale: req.headers.locale }),
    validators.campaigns.campaignsSchema,
  );
  if (validationError) return renderError(res, validationError);
  const {
    // eslint-disable-next-line camelcase
    campaigns, campaigns_types, hasMore, sponsors, radius, error,
  } = await getEligibleCampaigns(params);
  if (error) renderError(res, { error: error.message });
  else {
    renderSuccess(res, {
      campaigns, campaigns_types, hasMore, sponsors, radius,
    });
  }
};

const history = async (req, res) => {
  const { params, validationError } = validators.validate(
    Object.assign(req.body, { appName: req.headers.app, locale: req.headers.locale }),
    validators.campaigns.historySchema,
  );
  if (validationError) return renderError(res, validationError);
  const {
    // eslint-disable-next-line camelcase
    campaigns, campaigns_types, hasMore, sponsors, campaigns_names, error,
  } = await getHistory(params);
  if (error) renderError(res, { error: error.message });
  else {
    renderSuccess(res, {
      campaigns, campaigns_types, hasMore, sponsors, campaigns_names,
    });
  }
};

/**
 * Create new campaign with data from request,
 * first check can user create campaign (all user active campaigns found in database
 * and if count of it > max allowed count return error )
 */
const create = async (req, res) => {
  const {
    params,
    validationError,
  } = validators.validate(req.body, validators.campaigns.createSchema);

  if (validationError) return renderError(res, validationError);
  const { campaign, error } = await createCampaign(params);

  if (error) renderError(res, { error: error.message });
  else renderSuccess(res, { campaign });
};

/**
 * Show campaign by campaign_id
 */
const show = async (req, res) => {
  const { campaign, error } = await getCampaign(
    { campaign_id: req.params.campaign_id, appName: req.headers.app, locale: req.headers.locale },
  );
  if (!campaign) return renderNotFound(res);
  if (error) return renderError(res, { error: error.message });
  renderSuccess(res, { campaign });
};

/**
 * Delete campaign if it with status pending
 */
const destroy = async (req, res) => {
  const campaign = await destroyCampaign(req.params.campaign_id);

  if (!campaign) renderNotFound(res, { error: 'Campaign not found' });
  else renderSuccess(res, { deletedCampaign: campaign });
};

/**
 * Return campaigns dashboard for guide
 */
const campaignsDashboard = async (req, res) => {
  // eslint-disable-next-line camelcase
  const { campaigns, error, budget_total } = await getDashboard(
    { guideName: req.params.guide_name },
  );

  if (error) renderError(res, error.message);
  else renderSuccess(res, { dashboard: { campaigns, budget_total } });
};

/**
 * Validate pending campaign before activation
 */
const validateActivationCampaign = async (req, res) => {
  const {
    params,
    validationError,
  } = validators.validate(req.body, validators.campaigns.validateActivationSchema);

  if (validationError) return renderError(res, validationError);
  const { is_valid: isValid, message } = await preValidationHelper.validateActivation(params);

  if (isValid) renderSuccess(res, { result: isValid });
  else renderError(res, message);
};

/**
 * Check for possibility reserve campaign by current user
 */
const validateAssignCampaign = async (req, res) => {
  const {
    params,
    validationError,
  } = validators.validate(req.body, validators.campaigns.validateAssignSchema);

  if (validationError) return renderError(res, validationError);
  const { is_valid: isValid, message } = await preValidationHelper.validateAssign(params);

  if (isValid) renderSuccess(res, { result: isValid });
  else renderError(res, message);
};

const validateRejectAssignCampaign = async (req, res) => {
  const {
    params,
    validationError,
  } = validators.validate(req.body, validators.campaigns.validateRejectSchema);

  if (validationError) return renderError(res, validationError);
  const { is_valid: isValid, message } = await preValidationHelper.validateRejectAssign(params);

  if (isValid) renderSuccess(res, { result: isValid });
  else renderError(res, message);
};

const validateStopCampaign = async (req, res) => {
  const {
    params,
    validationError,
  } = validators.validate(req.body, validators.campaigns.validateStopSchema);

  if (validationError) return renderError(res, validationError);
  const { is_valid: isValid, message } = await preValidationHelper.validateInactivation(params);

  if (isValid) renderSuccess(res, { result: isValid });
  else renderError(res, message);
};

/**
 * Return statistic for user, and data for switch tab for show (reserved, eligible, all)
 * @param req
 * @param res
 * @returns {Promise<*>}
 */
const getCampaignsStatistic = async (req, res) => {
  const {
    params,
    validationError,
  } = validators.validate(
    Object.assign(req.body, { appName: req.headers.app, locale: req.headers.locale }),
    validators.campaigns.validateStatisticsSchema,
  );

  if (validationError) return renderError(res, validationError);
  const result = await getDataForFirstLoad(params);

  renderSuccess(res, result);
};

const getCampaignsTabType = async (req, res) => {
  const {
    params,
    validationError,
  } = validators.validate(
    Object.assign(req.body, { appName: req.headers.app, locale: req.headers.locale }),
    validators.campaigns.validateStatisticsSchema,
  );
  if (validationError) return renderError(res, validationError);
  const { tabType } = await getDataForFirstLoad(params);
  renderSuccess(res, tabType);
};

const userRewards = async (req, res) => {
  const { params, validationError } = validators
    .validate({
      ...req.query,
      name: req.params.userName,
    }, validators.campaigns.validateUserRewardsSchema);
  if (validationError) return renderError(res, validationError);

  const {
    // eslint-disable-next-line camelcase
    campaigns, campaigns_types, hasMore, sponsors, radius, error,
  } = await getUserRewards(params);
  if (error) return renderNotFound(res, error);

  renderSuccess(res, {
    campaigns, campaigns_types, hasMore, sponsors, radius,
  });
};

const checkReview = async (req, res) => {
  const { params, validationError } = validators
    .validate({
      ...req.query,
      _id: req.params.campaignId,
      locale: req.headers.locale,
    }, validators.campaigns.validateCheckReviewSchema);
  if (validationError) return renderError(res, validationError);
  const { campaign, error } = await checkingReview(params);
  if (error) return renderCustomError(res, error);
  renderSuccess(res, { campaign });
};

const getWobjectCampaigns = async (req, res) => {
  const { params, validationError } = validators.validate(
    { ...req.query, locale: req.headers.locale }, validators.campaigns.campaignsByWobjectSchema,
  );
  if (validationError) return renderError(res, validationError);

  const { campaigns, propositions, error } = await getCampaignsByWobject(params);

  if (error) return renderCustomError(res, error);
  renderSuccess(res, { campaigns, propositions });
};

module.exports = {
  validateRejectAssignCampaign,
  validateActivationCampaign,
  reservedCampaignsCount,
  validateAssignCampaign,
  getCampaignsStatistic,
  getCampaignsTabType,
  validateStopCampaign,
  getWobjectCampaigns,
  campaignsDashboard,
  eligibleCampaigns,
  reservedCampaigns,
  allCampaigns,
  checkReview,
  userRewards,
  destroy,
  history,
  create,
  show,
};
