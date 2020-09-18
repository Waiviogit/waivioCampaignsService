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
