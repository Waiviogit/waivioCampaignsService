const { sendSentryNotification } = require('utilities/requests/telegramNotificationsRequest');
const { CurrenciesStatistic } = require('currenciesDB').models;
const Sentry = require('@sentry/node');
const mongoose = require('mongoose');
const moment = require('moment');
const _ = require('lodash');

module.exports = async ({ from, to }) => {
  const datesWithError = [];
  const dates = getDates(new Date(from), new Date(to));

  for (const date of dates) {
    const startOfDay = moment.utc(date).startOf('day').toDate();
    const endOfDay = moment.utc(date).endOf('day').toDate();
    const dailyData = await CurrenciesStatistic.findOne({
      type: 'dailyData',
      createdAt: { $gte: startOfDay, $lte: endOfDay },
    }).lean();
    if (dailyData) continue;
    const creationErr = await addMissingDate({ startOfDay, endOfDay, date });
    if (creationErr) datesWithError.push(creationErr);
  }
  if (!_.isEmpty(datesWithError)) {
    Sentry.captureException(datesWithError);
    await sendSentryNotification();
  }

  console.info('task completed');
};

const addMissingDate = async ({ startOfDay, endOfDay, date }) => {
  const { dailyData, error } = await aggregationResult({ startOfDay, endOfDay });
  if (error) return date;
  dailyData._id = mongoose.Types.ObjectId(moment.utc(date).set({ hour: 0, minute: 13 }).unix());
  dailyData.createdAt = moment.utc(date).set({ hour: 0, minute: 13 }).format();
  try {
    await CurrenciesStatistic.create(dailyData);
  } catch (error) {
    return [date, dailyData, error.message];
  }
  return false;
};

const aggregationResult = async ({ startOfDay, endOfDay }) => {
  try {
    const dailyData = await CurrenciesStatistic.aggregate([
      {
        $match: {
          $and: [{ createdAt: { $gt: startOfDay } }, { createdAt: { $lt: endOfDay } }],
          type: 'ordinaryData',
          'hive_dollar.usd': { $ne: NaN },
          'hive_dollar.usd_24h_change': { $ne: NaN },
          'hive_dollar.btc': { $ne: NaN },
          'hive_dollar.btc_24h_change': { $ne: NaN },
          'hive.usd': { $ne: NaN },
          'hive.usd_24h_change': { $ne: NaN },
          'hive.btc': { $ne: NaN },
          'hive.btc_24h_change': { $ne: NaN },
        },
      },
      {
        $group: {
          _id: null,
          hive_dollar_usd: { $avg: '$hive_dollar.usd' },
          hive_dollar_usd_24h: { $avg: '$hive_dollar.usd_24h_change' },
          hive_dollar_btc: { $avg: '$hive_dollar.btc' },
          hive_dollar_btc_24h: { $avg: '$hive_dollar.btc_24h_change' },
          hive_usd: { $avg: '$hive.usd' },
          hive_usd_24h: { $avg: '$hive.usd_24h_change' },
          hive_btc: { $avg: '$hive.btc' },
          hive_btc_24h: { $avg: '$hive.btc_24h_change' },
        },
      },
      {
        $project: {
          _id: 0,
          type: 'dailyData',
          'hive_dollar.usd': '$hive_dollar_usd',
          'hive_dollar.usd_24h_change': '$hive_dollar_usd_24h',
          'hive_dollar.btc': '$hive_dollar_btc',
          'hive_dollar.btc_24h_change': '$hive_dollar_btc_24h',
          'hive.usd': '$hive_usd',
          'hive.usd_24h_change': '$hive_usd_24h',
          'hive.btc': '$hive_btc',
          'hive.btc_24h_change': '$hive_btc_24h',
        },
      },
    ]);
    if (_.isEmpty(dailyData)) return { error: { message: 'empty array' } };
    return { dailyData: _.get(dailyData, '[0]') };
  } catch (error) {
    return { error };
  }
};

const getDates = (firstDate, secondDate) => {
  const dates = [];
  while (firstDate < secondDate) {
    firstDate.setDate(firstDate.getDate() + 1);
    dates.push(moment.utc(firstDate).startOf('day').valueOf());
  }
  return dates;
};
