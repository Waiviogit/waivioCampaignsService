const { Signature } = require('@hiveio/dhive');
const crypto = require('node:crypto');
const { parseJson } = require('./jsonHelper');
const { redisGetter, redisSetter } = require('../redis');
const { getAccountInfo } = require('../hiveApi/hiveOperations');

const VERIFY_SIGNATURE_TYPE = {
  CUSTOM_JSON: 'customJson',
  COMMENT: 'comment',
  COMMENT_OBJECTS: 'commentObjects',
};

const CUSTOM_JSON_OPS = {
  WOBJ_RATING_GUEST: 'waivio_guest_wobj_rating',
  WAIVIO_GUEST_VOTE: 'waivio_guest_vote',
  WAIVIO_GUEST_FOLLOW: 'waivio_guest_follow',
  WAIVIO_GUEST_FOLLOW_WOBJECT: 'waivio_guest_follow_wobject',
  WAIVIO_GUEST_REBLOG: 'waivio_guest_reblog',
  WAIVIO_GUEST_ACCOUNT_UPDATE: 'waivio_guest_account_update',
  WAIVIO_GUEST_BELL: 'waivio_guest_bell',
  GUEST_HIDE_POST: 'waivio_guest_hide_post',
  GUEST_HIDE_COMMENT: 'waivio_guest_hide_comment',
  WEBSITE_GUEST: 'website_guest',
};

const guestAccountById = {
  [CUSTOM_JSON_OPS.WEBSITE_GUEST]: (payload) => payload.userName,
  [CUSTOM_JSON_OPS.GUEST_HIDE_COMMENT]: (payload) => payload.guestName,
  [CUSTOM_JSON_OPS.GUEST_HIDE_POST]: (payload) => payload.guestName,
  [CUSTOM_JSON_OPS.WOBJ_RATING_GUEST]: (payload) => payload.guestName,
  [CUSTOM_JSON_OPS.WAIVIO_GUEST_BELL]: (payload) => payload[1]?.follower,
  [CUSTOM_JSON_OPS.WAIVIO_GUEST_ACCOUNT_UPDATE]: (payload) => payload.account,
  [CUSTOM_JSON_OPS.WAIVIO_GUEST_REBLOG]: (payload) => payload[1]?.account,
  [CUSTOM_JSON_OPS.WAIVIO_GUEST_FOLLOW_WOBJECT]: (payload) => payload[1]?.user,
  [CUSTOM_JSON_OPS.WAIVIO_GUEST_FOLLOW]: (payload) => payload[1]?.follower,
  [CUSTOM_JSON_OPS.WAIVIO_GUEST_VOTE]: (payload) => payload.voter,
  default: () => '',
};

const getTransactionAccount = (operation) => (
  operation?.required_posting_auths?.[0] || operation?.required_auths?.[0]
);

const omitObjectSignature = (payload) => {
  const { signature, ...rest } = payload;
  return rest;
};

const getFromCustomJson = (operation) => {
  const account = getTransactionAccount(operation);
  const payload = parseJson(operation.json, {});
  const isArray = Array.isArray(payload);

  const signature = isArray
    ? payload[payload.length - 1]
    : payload.signature;

  const jsonWithoutSignature = isArray
    ? payload.slice(0, payload.length - 1)
    : omitObjectSignature(payload);

  const message = JSON.stringify({
    account, id: operation.id, json: JSON.stringify(jsonWithoutSignature),
  });

  const guestAccount = (guestAccountById[operation.id] || guestAccountById.default)(payload);

  const [signer] = guestAccount.split('_');

  return { message, signature, signer };
};

const getFromComment = (operation) => {
  const { author, permlink } = operation;
  const payload = parseJson(operation.json_metadata, {});
  const { signature } = payload;
  const message = JSON.stringify({ author, permlink });
  const guestAccount = payload.comment.userId;

  const [signer] = guestAccount.split('_');

  return { message, signature, signer };
};

const getFromCommentObjects = (operation) => {
  const { author, permlink } = operation;
  const payload = parseJson(operation.json_metadata, {});
  const { signedTrx } = payload;
  if (!signedTrx) return { message: '', signature: '', signer: '' };
  const message = JSON.stringify({ author, permlink });

  const { signature, signer } = signedTrx;

  return { message, signature, signer };
};

const getSignatureAndSigner = {
  [VERIFY_SIGNATURE_TYPE.CUSTOM_JSON]: getFromCustomJson,
  [VERIFY_SIGNATURE_TYPE.COMMENT]: getFromComment,
  [VERIFY_SIGNATURE_TYPE.COMMENT_OBJECTS]: getFromCommentObjects,
  default: () => ({ message: '', signature: '', signer: '' }),
};

const getSignerPubKey = async (name) => {
  const key = `pub_memo_key:${name}`;
  const cache = await redisGetter.get({ key });
  if (cache) return cache;

  const user = await getAccountInfo(name);
  if (user.error) return '';

  const result = user.memo_key;
  await redisSetter.setEx({
    key, value: result, ttlSeconds: 60 * 10,
  });
  return result;
};

const verifySignature = async ({ operation, type }) => {
  try {
    const {
      message,
      signature,
      signer,
    } = (getSignatureAndSigner[type] || getSignatureAndSigner.default)(operation);

    if (!message || !signature || !signer) return false;

    const hashedMessage = crypto.createHash('sha256').update(message).digest();

    const signatureObj = Signature.fromString(signature);

    const pubKeyObj = signatureObj.recover(hashedMessage);
    const pubKey = pubKeyObj.toString();

    const signerPubKey = await getSignerPubKey(signer);
    if (!signerPubKey) return false;

    return pubKey === signerPubKey;
  } catch (error) {
    console.log(error.message);
    return false;
  }
};

module.exports = {
  verifySignature,
  VERIFY_SIGNATURE_TYPE,
};
