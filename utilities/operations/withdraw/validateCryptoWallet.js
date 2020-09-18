const { validateWallet } = require('utilities/requests/blocktradesRequests');

module.exports = async ({ address, crypto }) => validateWallet({ address, crypto });
