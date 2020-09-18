const _ = require('lodash');
const render = require('concerns/renderConcern');
const config = require('config');
const axios = require('axios');

exports.validateAuthToken = async (req, res, next) => {
  const response = await axios.post(
    `${config.waivioUrl}auth/validate_auth_token`,
    {},
    { headers: { 'access-token': req.headers['access-token'] } },
  )
    .then((data) => data)
    .catch((error) => error.response);

  if (response.status === 401) return render.unauthorized(res);
  req.user = response.data.user;
  next();
};

exports.validateUser = async (accessToken, userName) => {
  try {
    const result = await axios.post(
      `${config.waivioUrl}auth/validate_auth_token`,
      {},
      { headers: { 'access-token': accessToken } },
    );
    return _.get(result, 'data.user.name') === userName;
  } catch (error) {
    return false;
  }
};

exports.createWithdraw = async (data) => {
  try {
    const result = await axios.post(
      `${config.withdrawUrl}campaigns-api/withdraw/create-demo-payment`,
      data,
      { headers: { secret: process.env.API_KEY } },
    );
    return !!result.data;
  } catch (error) {
    return false;
  }
};
