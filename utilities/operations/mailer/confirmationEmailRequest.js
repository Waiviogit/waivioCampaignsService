const _ = require('lodash');
const {
  DEFAULT_MAIL_TTL_TIME, DEFAULT_TRANSACTION_TTL_TIME, redirectIds,
  DEFAULT_TRANSACTION_REDIS_TTL_TIME,
} = require('constants/mailer');
const { withdrawFundsModel, userModel } = require('models');
const config = require('config');
const { mailerRequests } = require('utilities/requests');
const jwt = require('jsonwebtoken');
const { validateTransaction } = require('utilities/helpers/transactionsHelper');
const redisSetter = require('utilities/redis/redisSetter');
const { WITHDRAW_TRANSACTION } = require('constants/ttlData');

module.exports = async ({
  email, userName, accessToken, isGuest, transactionData, type,
}) => {
  const {
    templateId, templateData, error, oldEmail,
  } = await dataSwitcher({
    type, userName, email, transactionData, accessToken,
  });
  if (error) return { error: { response: { status: error.status, statusText: error.message } } };
  const data = {
    from: process.env.MAILER_FROM,
    to: oldEmail || email,
    userName,
    templateId,
    templateData,
  };
  const headers = {
    'mail-api-key': process.env.MAILER_API_KEY,
  };
  isGuest ? headers['waivio-auth'] = accessToken : headers['access-token'] = accessToken;
  return mailerRequests.send(data, headers);
};

const dataSwitcher = async ({
  type, userName, email, transactionData, accessToken,
}) => {
  let expiresIn, templateId, token;
  switch (type) {
    case 'confirmEmail':
      const { user } = await userModel.findOne(userName, '+privateEmail');
      if (_.get(user, 'privateEmail')) return { error: { status: 409, message: 'Email exist, untie it first' } };
      expiresIn = DEFAULT_MAIL_TTL_TIME;
      templateId = process.env.CONFIRMATION_TEMPLATE;
      token = jwt.sign({ email, userName, transactionData },
        process.env.CRYPTO_KEY, { expiresIn });
      return {
        templateId,
        templateData: {
          from: process.env.MAILER_FROM,
          userLink: `${config.waivioUrl}@${userName}`,
          userName,
          baseLink: `${config.waivioUrl}campaigns-api/mailer/confirm-email-response?userName=${userName}&email=${email}&id=${token}&type=confirm`,
        },
      };
    case 'confirmTransaction':
      const {
        error, amount, transaction, commission, usdValue, checkEmail,
      } = await validateTransaction({
        transactionData, userName, email, accessToken,
      });
      if (error) return { error };
      expiresIn = DEFAULT_TRANSACTION_TTL_TIME;
      templateId = process.env.TRANSACTION_TEMPLATE;

      const { withdraw } = await withdrawFundsModel.create({
        commission,
        memo: transaction.memo,
        receiver: transaction.address,
        usdValue,
        email,
        account: userName,
        ..._.pick(transactionData, ['inputCoinType', 'outputCoinType', 'amount', 'address']),
      });
      if (!withdraw) return { error: { response: { status: 503 } } };

      await redisSetter.saveTTL(`expire:${WITHDRAW_TRANSACTION}|${withdraw._id}`, DEFAULT_TRANSACTION_REDIS_TTL_TIME);
      const baseLink = checkEmail === 'No email' ? `${config.waivioUrl}campaigns-api/mailer/confirm-email-in-transaction?id=${redirectIds.finalConfirmTransaction}&userName=${userName}&token=${withdraw._id}&reqAmount=${transactionData.amount}&inputCoinType=${transactionData.inputCoinType}&outputCoinType=${transactionData.outputCoinType}&depositAcc=${transactionData.address}&memo=${transaction.memo}&commission=${commission}&email=${email}`
        : `${config.waivioUrl}confirmation?id=${redirectIds.finalConfirmTransaction}&userName=${userName}&token=${withdraw._id}&reqAmount=${transactionData.amount}&inputCoinType=${transactionData.inputCoinType}&outputCoinType=${transactionData.outputCoinType}&depositAcc=${transactionData.address}&memo=${transaction.memo}&commission=${commission}`;
      return {
        templateId,
        templateData: {
          from: process.env.MAILER_FROM,
          userLink: `${config.waivioUrl}@${userName}`,
          userName,
          baseLink,
          transaction: transaction.memo,
          inputCoinType: transactionData.inputCoinType.toUpperCase(),
          reqAmount: transactionData.amount,
          outputCoinType: transactionData.outputCoinType.toUpperCase(),
          resAmount: amount,
          depositAcc: transactionData.address,
        },
      };
    case 'pullEmail':
      const { user: User } = await userModel.findOne(userName, '+privateEmail');
      if (!_.get(User, 'privateEmail')) return { error: { status: 409, message: 'Email not exist, confirm it first' } };
      expiresIn = DEFAULT_MAIL_TTL_TIME;
      templateId = process.env.UNLINK_TEMPLATE;
      token = jwt.sign({ email, userName, transactionData },
        process.env.CRYPTO_KEY, { expiresIn });
      return {
        templateId,
        oldEmail: User.privateEmail,
        templateData: {
          from: process.env.MAILER_FROM,
          userLink: `${config.waivioUrl}@${userName}`,
          userName,
          baseLink: `${config.waivioUrl}campaigns-api/mailer/confirm-email-response?userName=${userName}&id=${token}&type=unlink`,
        },
      };
  }
};
