const { sendSentryNotification } = require('utilities/requests/telegramNotificationsRequest');
const { CurrenciesStatistic } = require('currenciesDB').models;
const Sentry = require('@sentry/node');
const mongoose = require('mongoose');
const moment = require('moment');
const axios = require('axios');
const _ = require('lodash');

module.exports = async () => {
  const datesWithError = [];
  const steemFrom = moment.utc('2016-04-18').startOf('day').unix();
  const sbdFrom = moment.utc('2016-07-18').startOf('day').unix();
  const to = moment.utc('2020-03-26').startOf('day').unix();
  const dates = getDates(new Date('2016-04-17'), new Date('2020-03-26'));

  const { prices: steemVsUSD, error: steemVsUSDErr } = await getCurrencyHistoryCoingecko('steem', steemFrom, to, 'usd');
  const { prices: steemVsBTC, error: steemVsBTCErr } = await getCurrencyHistoryCoingecko('steem', steemFrom, to, 'btc');
  const { prices: sbdVsUSD, error: sbdVsUSDErr } = await getCurrencyHistoryCoingecko('steem-dollars', sbdFrom, to, 'usd');
  const { prices: sbdVsBTC, error: sbdVsBTCErr } = await getCurrencyHistoryCoingecko('steem-dollars', sbdFrom, to, 'btc');

  if (sbdVsBTCErr || sbdVsUSDErr || steemVsBTCErr || steemVsUSDErr) return console.error('relaunch task');

  for (const date of dates) {
    const errorCreating = await createRecordWithSteem({
      date, steemVsUSD, steemVsBTC, sbdVsUSD, sbdVsBTC,
    });
    if (errorCreating) datesWithError.push(errorCreating);
  }
  if (!_.isEmpty(datesWithError)) {
    Sentry.captureException(datesWithError);
    await sendSentryNotification();
  }
  console.info('task completed');
};

const getDates = (firstDate, secondDate) => {
  const dates = [];
  while (firstDate < secondDate) {
    firstDate.setDate(firstDate.getDate() + 1);
    dates.push(moment.utc(firstDate).startOf('day').valueOf());
  }
  return dates;
};

const createRecordWithSteem = async ({
  date, steemVsUSD, steemVsBTC, sbdVsUSD, sbdVsBTC,
}) => {
  const steemUSD = _.find(steemVsUSD, (el) => el[0] === date);
  const steemBTC = _.find(steemVsBTC, (el) => el[0] === date);
  const sbdUSD = _.find(sbdVsUSD, (el) => el[0] === date);
  const sbdBTC = _.find(sbdVsBTC, (el) => el[0] === date);

  const data = {
    _id: mongoose.Types.ObjectId(moment.utc(date).set({ hour: 0, minute: 13 }).unix()),
    type: 'dailyData',
    hive: {
      usd: _.get(steemUSD, '[1]', 0),
      usd_24h_change: 0,
      btc: _.get(steemBTC, '[1]', 0),
      btc_24h_change: 0,
    },
    hive_dollar: {
      usd: _.get(sbdUSD, '[1]', 0),
      usd_24h_change: 0,
      btc: _.get(sbdBTC, '[1]', 0),
      btc_24h_change: 0,
    },
    createdAt: moment.utc(date).set({ hour: 0, minute: 13 }).format(),
  };

  try {
    await CurrenciesStatistic.create(data);
  } catch (error) {
    return date;
  }
};

const getCurrencyHistoryCoingecko = async (id, from, to, vs_currency) => {
  try {
    const result = await axios.get(
      `https://api.coingecko.com/api/v3/coins/${id}/market_chart/range`,
      { params: { from, to, vs_currency } },
    );
    return {
      prices: _.get(result, 'data.prices'),
    };
  } catch (error) {
    console.error(error.message);
    return { error };
  }
};
