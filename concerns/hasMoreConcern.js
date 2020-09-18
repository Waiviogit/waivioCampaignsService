const _ = require('lodash');

const hasMore = async (model, field, value, order) => {
  let present;

  if (order === 1) {
    present = await model.findOne({ [field]: { $gt: value } });
  } else {
    present = await model.findOne({ [field]: { $lt: value } });
  }

  return !_.isEmpty(present);
};

module.exports = {
  hasMore,
};
