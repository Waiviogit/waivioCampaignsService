const Joi = require('@hapi/joi');
const { RESERVATION_STATUSES, CAMPAIGN_STATUSES } = require('constants/constants');

const options = { allowUnknown: true, stripUnknown: true };

exports.indexSchema = Joi.object().keys({
  guideNames: Joi.any(),
  types: Joi.array().items(Joi.string()),
  userName: Joi.string(),
  skip: Joi.number().default(0),
  limit: Joi.number().default(30),
  sort: Joi.string(),
  status: Joi.array().default(['active']),
  area: Joi.array().items(Joi.number()),
  coordinates: Joi.array().items(Joi.number(), null),
  radius: Joi.number().default(1000),
  approved_objects: Joi.array(),
  paymentStatus: Joi.string(),
  requiredObject: Joi.string(),
  approved: Joi.boolean(),
  currentUserName: Joi.string(),
  minReward: Joi.number(),
  maxReward: Joi.number(),
  primaryObject: Joi.string(),
}).options(options);

exports.createSchema = Joi.object().keys({
  id: Joi.string(),
  guideName: Joi.string().required(),
  name: Joi.string().max(256).required(),
  description: Joi.string(),
  type: Joi.string(),
  note: Joi.string(),
  budget: Joi.number(),
  reward: Joi.number(),
  requirements: {
    minPhotos: Joi.number().required(),
    receiptPhoto: Joi.boolean(),
  },
  userRequirements: Joi.object().keys({
    minPosts: Joi.number().required(),
    minFollowers: Joi.number().required(),
    minExpertise: Joi.number().required(),
  }).required(),
  requiredObject: Joi.string(),
  blacklist_users: Joi.array().items(Joi.string()),
  whitelist_users: Joi.array().items(Joi.string()),
  count_reservation_days: Joi.number(),
  frequency_assign: Joi.number(),
  match_bots: Joi.array().items(Joi.string()),
  reservation_timetable: {
    monday: Joi.boolean(),
    tuesday: Joi.boolean(),
    wednesday: Joi.boolean(),
    thursday: Joi.boolean(),
    friday: Joi.boolean(),
    saturday: Joi.boolean(),
    sunday: Joi.boolean(),
  },
  objects: Joi.array().items(Joi.string()),
  compensationAccount: Joi.string().allow(''),
  agreementObjects: Joi.array().items(Joi.string()),
  usersLegalNotice: Joi.string().allow(''),
  commissionAgreement: Joi.number().required(),
  app: Joi.string().min(1).max(256),
  expired_at: Joi.date(),
}).options(options);

exports.validateActivationSchema = Joi.object().keys({
  campaign_id: Joi.any().required(),
  guide_name: Joi.string().required(),
  permlink: Joi.string().required(),
}).options(options);

exports.validateAssignSchema = Joi.object().keys({
  campaign_permlink: Joi.string().required(),
  user_name: Joi.string().required(),
  approved_object: Joi.string().required(),
  reservation_permlink: Joi.string().required(),
}).options(options);

exports.validateRejectSchema = Joi.object().keys({
  campaign_permlink: Joi.string().required(),
  user_name: Joi.string().required(),
  reservation_permlink: Joi.string().required(),
  unreservation_permlink: Joi.string().required(),
}).options(options);

exports.validateStopSchema = Joi.object().keys({
  campaign_permlink: Joi.string().required(),
  guide_name: Joi.string().required(),
  permlink: Joi.string().required(),
}).options(options);

exports.validateSuitableSchema = Joi.object().keys({
  skip: Joi.number().default(0),
  limit: Joi.number().default(30),
  count_follows: Joi.number().default(0),
  count_posts: Joi.number().default(0),
});

exports.validateStatisticsSchema = Joi.object().keys({
  userName: Joi.string(),
  skip: Joi.number().default(0),
  locale: Joi.string().default('en-US'),
  appName: Joi.string().default('waivio'),
  limit: Joi.number().default(10),
  sort: Joi.string().valid('reward', 'date', 'proximity').default('reward'),
  status: Joi.array().default(['active']),
  area: Joi.array().ordered(
    Joi.number().min(-90).max(90),
    Joi.number().min(-180).max(180),
  ),
});

exports.campaignsSchema = Joi.object().keys({
  guideNames: Joi.array().items(Joi.string()),
  types: Joi.array().items(Joi.string()),
  status: Joi.array().default(['active']),
  locale: Joi.string().default('en-US'),
  appName: Joi.string().default('waivio'),
  skip: Joi.number().default(0),
  update: Joi.boolean().default(false),
  limit: Joi.number().default(10),
  userName: Joi.string(),
  sort: Joi.string().valid('reward', 'date', 'proximity').default('reward'),
  requiredObject: Joi.string(),
  primaryObject: Joi.string(),
  radius: Joi.number().min(0),
  simplified: Joi.boolean().when('requiredObject', { is: Joi.exist(), then: Joi.valid(false) }),
  firstMapLoad: Joi.boolean().when('requiredObject', { is: Joi.exist(), then: Joi.valid(false) }),
  area: Joi.array().ordered(
    Joi.number().min(-90).max(90),
    Joi.number().min(-180).max(180),
  ),
}).options(options);

exports.historySchema = Joi.object().keys({
  guideNames: Joi.array().items(Joi.string()),
  campaignNames: Joi.array().items(Joi.string()),
  fraudSuspicion: Joi.boolean().default(false),
  guideName: Joi.string(),
  userName: Joi.string(),
  locale: Joi.string().default('en-US'),
  appName: Joi.string().default('waivio'),
  onlyWithMessages: Joi.boolean().default(false),
  skip: Joi.number().default(0),
  limit: Joi.number().default(10),
  reservationPermlink: Joi.string(),
  sort: Joi.string().valid('inquiryDate', 'latest', 'reservation', 'lastAction').default('inquiryDate'),
  status: Joi.array().items(Joi.string().valid(...Object.values(CAMPAIGN_STATUSES))).default(Object.values(CAMPAIGN_STATUSES)),
  caseStatus: Joi.string().valid('open', 'close', 'all').default('all'),
  rewards: Joi.array().items(Joi.string().valid(...Object.values(RESERVATION_STATUSES))).default(Object.values(RESERVATION_STATUSES)),
});

exports.validateUserRewardsSchema = Joi.object().keys({
  name: Joi.string().required(),
  skip: Joi.number().default(0),
  limit: Joi.number().default(10),
}).options(options);
