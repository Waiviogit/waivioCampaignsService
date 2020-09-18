const mongoose = require('mongoose');

mongoose.connection.on('error', console.error.bind(console, 'MongoDB connection error:'));

mongoose.Promise = global.Promise;

module.exports = {
  Mongoose: mongoose,
  models: {
    Campaign: require('./schemas/CampaignSchema'),
    PaymentHistory: require('./schemas/PaymentHistorySchema'),
    User: require('./schemas/UserSchema'),
    Post: require('./schemas/PostSchema'),
    Blacklist: require('./schemas/BlacklistSchema'),
    Wobject: require('./schemas/wObjectSchema'),
    UserWobjects: require('./schemas/UserWobjectsSchema'),
    MatchBot: require('./schemas/MatchBotsSchema'),
    BotUpvote: require('./schemas/BotUpvoteSchema'),
    InternalExchange: require('./schemas/InternalExchangeSchema'),
    App: require('./schemas/AppSchema'),
    WithdrawFunds: require('./schemas/withdrawFundsSchema'),
    Subscriptions: require('./schemas/SubscriptionSchema'),
    ObjectType: require('./schemas/ObjectTypeSchema'),
    WobjectSubscriptions: require('./schemas/WobjectSubscriptionSchema'),
    BellWobject: require('./schemas/BellWobjectSchema'),
  },
};
