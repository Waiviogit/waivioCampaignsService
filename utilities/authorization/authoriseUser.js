const { getNamespace } = require('cls-hooked');
const hiveSignerRequests = require('utilities/requests/hiveSignerRequests');
const guestRequests = require('utilities/requests/guestRequests');

/**
 * Authorise particular user with "access-token" from session(if it exist)
 * and set "authorised_user" to current session
 * @param username Name of user(steem, facebook, google etc.)
 * @returns {Promise<{error: {message: string, status: number}}|{isValid: boolean}>}
 * Return {isValid: true} if user authorised successfully,
 * or {error} if Token not exist or not valid
 */
exports.authorise = async (username) => {
  const session = getNamespace('request-session');
  const accessToken = session.get('access-token');
  const isWaivioAuth = session.get('waivio-auth');
  let isValidToken;

  if (isWaivioAuth) {
    isValidToken = await guestRequests.validateUser(accessToken, username);
  } else {
    isValidToken = await hiveSignerRequests.validateHiveUser(accessToken, username);
  }

  if (isValidToken) {
    session.set('authorised_user', username);
    return { isValid: true };
  }

  return { error: { status: 401, message: 'Token not valid!' } };
};
