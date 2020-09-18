const mongoose = require('mongoose');
const db = require('database/db_Connection');

const { Schema } = mongoose;

const SubscriptionSchema = new Schema({
  follower: { type: String, required: true },
  following: { type: String, required: true },
}, { versionKey: false });

SubscriptionSchema.index({ follower: 1, following: 1 }, { unique: true });
SubscriptionSchema.index({ following: 1 });

const SubscriptionModel = db.model('Subscriptions', SubscriptionSchema);

module.exports = SubscriptionModel;
