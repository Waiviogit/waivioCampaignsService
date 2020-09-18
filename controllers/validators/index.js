module.exports = {
  withdraw: require('./withdrawValidator'),
  mailer: require('./mailerValidator'),
  campaigns: require('./campaignsValidator'),
  payables: require('./payablesValidator'),
  matchBots: require('./matchBotsValidator'),
  demoUsers: require('./demoUsersValidator'),
  referrals: require('./referralsValidator'),
  validate: (data, schema) => {
    const result = schema.validate(data, { abortEarly: false });

    if (result.error || !result.value) return { validationError: result.error || 'Data not exist' };
    return { params: result.value };
  },
};
