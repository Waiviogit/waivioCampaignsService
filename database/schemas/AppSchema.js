const mongoose = require('mongoose');
const db = require('database/db_Connection');
const { REFERRAL_TYPES } = require('constants/constants');

const { Schema } = mongoose;

const moderatorsSchema = new Schema({
  name: { type: String, required: true },
  author_permlinks: { type: [String], default: [] },
}, { _id: false });

const AuthoritySchema = new Schema({
  administrative: { type: [String], default: [] },
  ownership: { type: [String], default: [] },
}, { _id: false });

const TagsData = new Schema({
  Ingredients: { type: Object, default: {} },
  Cuisine: { type: Object, default: {} },
  'Good For': { type: Object, default: {} },
  Features: { type: Object, default: {} },
}, { _id: false });

const topUsersSchema = new Schema({
  name: { type: String, required: true },
  weight: { type: [String], default: [] },
}, { _id: false });

const botSchema = new Schema({
  name: { type: String, required: true },
  postingKey: { type: String, required: true },
  roles: { type: [String], required: true },
}, { _id: false });

const ReferralTimersSchema = new Schema({
  type: { type: String, enum: Object.values(REFERRAL_TYPES) },
  duration: { type: Number, default: 90 },
}, { _id: false });

const AppCommissions = new Schema({
  campaigns_server_acc: { type: String, required: true },
  campaigns_percent: {
    type: Number, min: 0, max: 1, required: true,
  },
  index_commission_acc: { type: String, required: true },
  index_percent: {
    type: Number, min: 0, max: 1, required: true,
  },
  referral_commission_acc: { type: String, required: true },
}, { _id: false });

const AppSchema = new Schema({
  name: { type: String, index: true, unique: true },
  admins: { type: [String], required: true },
  moderators: {
    type: [moderatorsSchema],
  },
  supported_object_types: [{
    object_type: { type: String, index: true },
    required_fields: { type: [String], default: [] },

  }],
  black_list_users: { type: [String], default: [] },
  authority: { type: AuthoritySchema, default: () => ({}) },
  supported_hashtags: { type: [String], default: [] },
  supported_objects: { type: [String], index: true, default: [] },
  top_users: { type: [topUsersSchema] },
  daily_chosen_post: {
    author: { type: String },
    permlink: { type: String },
    title: { type: String },
  },
  weekly_chosen_post: {
    author: { type: String },
    permlink: { type: String },
    title: { type: String },
  },
  service_bots: { type: [botSchema], default: [] },
  tagsData: { type: TagsData },
  app_commissions: { type: AppCommissions, required: true },
  referralsData: { type: [ReferralTimersSchema], default: [] },
}, { timestamps: true });

const AppModel = db.model('App', AppSchema);

module.exports = AppModel;
