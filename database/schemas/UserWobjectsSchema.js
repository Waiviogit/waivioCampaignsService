const mongoose = require('mongoose');
const db = require('database/db_Connection');

const { Schema } = mongoose;

const UserWobjectsSchema = new Schema({
  user_name: { type: String },
  author_permlink: { type: String },
  weight: { type: Number },
}, { timestamps: false });

UserWobjectsSchema.index({ user_name: 1 });
UserWobjectsSchema.index({ author_permlink: 1 });
UserWobjectsSchema.index({ author_permlink: 1, user_name: 1 }, { unique: true });


const UserWobjects = db.model('user_wobjects', UserWobjectsSchema);

module.exports = UserWobjects;
