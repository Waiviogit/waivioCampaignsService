const mongoose = require('mongoose');
const db = require('currenciesDB/currenciesDB_Connection');

const { Schema } = mongoose;

const reservationCurrencies = new Schema({
  hiveCurrency: { type: Number, required: true },
}, { timestamps: false });

const currenciesSchema = db.model('reservation-currencies', reservationCurrencies);

module.exports = currenciesSchema;
