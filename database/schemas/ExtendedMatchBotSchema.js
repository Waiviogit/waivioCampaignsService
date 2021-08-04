const mongoose = require('mongoose');
const db = require('database/db_Connection');
const { MATCH_BOT_TYPES } = require('constants/matchBotsData');

const { Schema } = mongoose;

const ExtendedMatchBotSchema = new Schema({
  botName: { type: String, required: true },
  type: { type: String, required: true, enum: Object.values(MATCH_BOT_TYPES) },
  accounts: [
    {
      name: { type: String, required: true },
      minVotingPower: {
        type: Number, default: 8000, min: 1, max: 10000, required: true,
      },
      voteWeight: { type: Number, min: 1, max: 10000 },
      voteRatio: { type: Number, min: 0.01, max: 10 },
      note: { type: String, maxlength: 256 },
      enabled: { type: Boolean, default: false, required: true },
      enablePowerDown: { type: Boolean, default: false },
      expiredAt: { type: Date, default: null },
      voteComments: { type: Boolean, default: false },
    },
  ],
}, { timestamps: true });

ExtendedMatchBotSchema.index({ botName: 1, type: 1 }, { unique: true });
ExtendedMatchBotSchema.pre('updateOne', function (next) {
  this.options.runValidators = true;
  next();
});

module.exports = db.model('extended_match_bots', ExtendedMatchBotSchema);
