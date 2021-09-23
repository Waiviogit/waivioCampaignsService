const { REFERRAL_TYPES, REFERRAL_STATUSES, SUPPORTED_CURRENCIES } = require('constants/constants');
const LANGUAGES = require('constants/languages');
const db = require('database/db_Connection');
const mongoose = require('mongoose');

const { Schema } = mongoose;

const ReferralsSchema = new Schema({
  agent: { type: String, index: true },
  startedAt: { type: Date },
  endedAt: { type: Date },
  type: { type: String, enum: Object.values(REFERRAL_TYPES) },
}, { _id: false });

const UserMetadataSchema = new Schema({
  notifications_last_timestamp: { type: Number, default: 0 },
  settings: {
    // Enable this option to use the exit page when clicking on an external link.
    exitPageSetting: { type: Boolean, default: false },
    locale: { type: String, enum: [...LANGUAGES], default: 'auto' }, // which language use on waivio
    // in which language do you want read posts
    postLocales: { type: [{ type: String, enum: [...LANGUAGES] }], default: [] },
    nightmode: { type: Boolean, default: false }, // toggle nightmode on UI
    rewardSetting: { type: String, enum: ['SP', '50', 'STEEM'], default: '50' }, // in which format get rewards from posts
    rewriteLinks: { type: Boolean, default: false }, // change links from steemit.com to waivio.com
    showNSFWPosts: { type: Boolean, default: false }, // show or hide NSFW posts
    upvoteSetting: { type: Boolean, default: false }, // enable auto like on your posts
    hiveBeneficiaryAccount: { type: String, default: '' },
    votePercent: {
      type: Number, min: 1, max: 10000, default: 5000,
    }, // default percent of your upvotes
    votingPower: { type: Boolean, default: false }, // dynamic toggle of vote power on each vote
  },
  currency: {
    type: String,
    enum: Object.values(SUPPORTED_CURRENCIES),
    default: SUPPORTED_CURRENCIES.USD,
  },
  bookmarks: { type: [String], default: [] },
  drafts: {
    type: [{
      title: { type: String },
      draftId: { type: String },
      author: { type: String },
      beneficiary: { type: Boolean, default: true },
      upvote: { type: Boolean },
      isUpdating: { type: Boolean },
      body: { type: String },
      originalBody: { type: String },
      jsonMetadata: { type: Object },
      lastUpdated: { type: Number },
      parentAuthor: { type: String },
      parentPermlink: { type: String },
      permlink: { type: String },
      reward: { type: String },
    }],
    default: [],
  },
  new_user: { type: Boolean, default: true },
});

const UserSchema = new Schema({
  name: { type: String, index: true, unique: true },
  alias: { type: String },
  profile_image: { type: String },
  read_locales: { type: [String], default: [] },
  objects_follow: { type: [String], default: [] },
  users_follow: { type: [String], default: [] }, // arr of users which user follow
  json_metadata: { type: String, default: '' },
  count_posts: { type: Number, default: 0, index: true },
  followers_count: { type: Number, default: 0 },
  users_following_count: { type: Number, default: 0 },
  user_metadata: { type: UserMetadataSchema, default: () => ({}) },
  wobjects_weight: { type: Number, default: 0 }, // sum of weight of all wobjects
  app_settings: { type: Object, default: [] },
  privateEmail: { type: String, default: null, select: false },
  referralStatus: {
    type: String,
    enum: Object.values(REFERRAL_STATUSES),
    default: REFERRAL_STATUSES.NOT_ACTIVATED,
  },
  referral: { type: [ReferralsSchema], default: [] },
}, { timestamps: true });

const UserModel = db.model('User', UserSchema, 'users');

module.exports = UserModel;
