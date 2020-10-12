const nodeUrls = ['https://anyx.io', 'https://rpc.esteem.app/', 'https://api.hive.blog', 'https://api.hevekings.com'];

const notificationsApi = {
  production: {
    HOST: 'https://www.waivio.com',
    BASE_URL: '/notifications-api',
    SET_NOTIFICATION: '/set',
  },
  staging: {
    HOST: 'https://waiviodev.com',
    BASE_URL: '/notifications-api',
    SET_NOTIFICATION: '/set',
  },
  development: {
    HOST: 'http://localhost:4000',
    BASE_URL: '/notifications-api',
    SET_NOTIFICATION: '/set',
  },
  test: {
    HOST: 'http://localhost:4000',
    BASE_URL: '/notifications-api',
    SET_NOTIFICATION: '/set',
  },
};

const telegramApi = {
  HOST: 'https://waiviodev.com',
  BASE_URL: '/telegram-api',
  SENTRY_ERROR: '/sentry',

};

const mailerApi = {
  production: {
    HOST: 'https://www.waivio.com',
    BASE_URL: '/email-api',
    SEND_EMAIL: '/send',
  },
  staging: {
    HOST: 'https://waiviodev.com',
    BASE_URL: '/email-api',
    SEND_EMAIL: '/send',
  },
  development: {
    HOST: 'https://waiviodev.com',
    BASE_URL: '/email-api',
    SEND_EMAIL: '/send',
  },
  test: {
    HOST: 'http://localhost:8100',
    BASE_URL: '/email-api',
    SEND_EMAIL: '/send',
  },
};

const blocktradesApi = {
  HOST: 'https://blocktrades.us/api/v2',
  ESTIMATE_OUTPUT: '/estimate-output-amount',
  SESSION: '/sessions',
  TRANSACTIONS: '/transactions',
  WALLET: '/wallets',
  WALLET_VALIDATE: '/address-validator',
  MAPPINGS: '/mappings',
};

const orderIds = {
  '@@000000013': 'HBD',
  '@@000000021': 'HIVE',
};

const MIN_DEBT_TO_SUSPENDED = 2;
const MIN_TO_PAYED_VALUE = 0.001;

module.exports = {
  telegramApi,
  MIN_DEBT_TO_SUSPENDED,
  MIN_TO_PAYED_VALUE,
  nodeUrls,
  notificationsApi: notificationsApi[process.env.NODE_ENV || 'development'],
  mailerApi: mailerApi[process.env.NODE_ENV || 'development'],
  orderIds,
  blocktradesApi,
};
