const db = require('database/db_Connection');
const mongoose = require('mongoose');

const { Schema } = mongoose;

const WalletExemptionsSchema = new Schema({
  userName: { type: String },
  userWithExemptions: { type: String },
  exemptions: { type: Array, default: [] },
}, { timestamps: false });

WalletExemptionsSchema.index({ userName: 1, userWithExemptions: 1 }, { unique: true });

const WalletExemptions = db.model('wallet_exemptions', WalletExemptionsSchema);

module.exports = WalletExemptions;
