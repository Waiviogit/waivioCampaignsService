const mongoose = require('mongoose');
const db = require('database/db_Connection');

const { Schema } = mongoose;

const AuthoritySchema = new Schema({
  administrative: { type: [String], default: [] },
  ownership: { type: [String], default: [] },
}, { _id: false });

const WObjectSchema = new Schema({
  app: String,
  community: String,
  object_type: String,
  default_name: { type: String, required: true },
  is_posting_open: { type: Boolean, default: true },
  is_extending_open: { type: Boolean, default: true },
  creator: { type: String, required: true },
  author: { type: String, required: true },
  authority: { type: AuthoritySchema, default: () => ({}) },
  author_permlink: {
    type: String, index: true, unique: true, required: true,
  }, // unique identity for wobject, link to create object POST
  weight: { type: Number, default: 1 },
  parent: { type: String, default: '' },
  children: { type: [String], default: [] },
  fields: [{
    name: { type: String, index: true },
    body: { type: String },
    weight: { type: Number, default: 1 },
    locale: { type: String, default: 'en-US' },
    creator: { type: String },
    author: String, //
    permlink: String, // author+permlink it's link to appendObject COMMENT
    active_votes: {
      type: [{
        voter: { type: String },
        weight: { type: Number },
        percent: { type: Number },
        rshares_weight: { type: Number },
      }],
      default: [],
    },
  }],
  map: {
    type: {
      type: String, // Don't do `{ location: { type: String } }`
      enum: ['Point'], // 'location.type' must be 'Point'
    },
    coordinates: {
      type: [Number], // First element - longitude(-180..180), second element - latitude(-90..90)
    }, // [longitude, latitude]
  },
  activeCampaigns: { type: [mongoose.Types.ObjectId], default: [] },
  activeCampaignsCount: { type: Number, default: 0 },
},
{
  toObject: { virtuals: true }, timestamps: true,
});

WObjectSchema.index({ map: '2dsphere' });
WObjectSchema.index({ weight: -1 });
WObjectSchema.index({ activeCampaignsCount: -1, weight: -1 });

WObjectSchema.virtual('followers', {
  ref: 'User',
  localField: 'author_permlink',
  foreignField: 'objects_follow',
  justOne: false,
});

WObjectSchema.virtual('child_objects', {
  ref: 'wobject',
  localField: 'children',
  foreignField: 'author_permlink',
  justOne: false,
});

WObjectSchema.virtual('users', {
  ref: 'User',
  localField: 'author_permlink',
  foreignField: 'w_objects.author_permlink',
  justOne: false,
});

const wObjectModel = db.model('wobject', WObjectSchema);

module.exports = wObjectModel;
