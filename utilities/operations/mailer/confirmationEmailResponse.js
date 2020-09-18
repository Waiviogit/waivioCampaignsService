const _ = require('lodash');
const { userModel } = require('models');
const { redirectIds } = require('constants/mailer');
const jwt = require('jsonwebtoken');

module.exports = async ({
  userName, id, email, type,
}) => {
  const { result } = verifyToken({ userName, id });
  if (!result) return { error: { id: type === 'confirm' ? redirectIds.confirmEmailSecretFailed : redirectIds.unlinkEmailSecretFailed } };
  await userModel.updateOne({ name: userName }, { privateEmail: type === 'confirm' ? email : null });
  return { result: { id: type === 'confirm' ? redirectIds.confirmEmailSuccess : redirectIds.unlinkEmailSuccess } };
};

const verifyToken = ({ id, userName }) => {
  try {
    const token = jwt.verify(id, process.env.CRYPTO_KEY);
    if (_.get(token, 'userName') !== userName) {
      return { result: false };
    }
    return { result: true };
  } catch (error) {
    return { result: false };
  }
};
