
exports.MAILER_API_KEY = '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';
exports.CONFIRMATION_TEMPLATE = 'd-0d571b51d8d34bc8aca7da263af8c9b9';
exports.UNLINK_TEMPLATE = 'd-557cd5d2c3b448a48ec033e9d0e9b43d';
exports.TRANSACTION_TEMPLATE = 'd-5455d4fc57b2471382c1a20c7526b079';
exports.MAILER_FROM = 'support@waivio.com';
exports.DEFAULT_MAIL_TTL_TIME = '15m';
exports.DEFAULT_TRANSACTION_TTL_TIME = '5m';
exports.DEFAULT_TRANSACTION_REDIS_TTL_TIME = 300;

exports.redirectIds = {
  confirmEmailTimeFailed: 'confirmEmailTimeFailed',
  confirmEmailSecretFailed: 'confirmEmailSecretFailed',
  unlinkEmailSecretFailed: 'unlinkEmailSecretFailed',
  confirmEmailSuccess: 'confirmEmailSuccess',
  unlinkEmailSuccess: 'unlinkEmailSuccess',
  finalConfirmTransaction: 'finalConfirmTransaction',
};
