const db = require('database/db_Connection');
const mongoose = require('mongoose');

const { Schema } = mongoose;

const WalletExemptionsSchema = new Schema({
  userName: { type: String },
  userWithExemptions: { type: String },
  _id: { type: mongoose.ObjectId },
  operationNum: { type: Number },
}, { timestamps: false });

WalletExemptionsSchema.index({ userName: 1, userWithExemptions: 1, _id: 1 }, { unique: true });
WalletExemptionsSchema.index(
  { userName: 1, userWithExemptions: 1, operationNum: 1 }, { unique: true },
);

const WalletExemptions = db.model('wallet_exemptions', WalletExemptionsSchema);

module.exports = WalletExemptions;
