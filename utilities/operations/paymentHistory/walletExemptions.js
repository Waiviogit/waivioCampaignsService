const { walletExemptionsModel } = require('models');
const { ObjectId } = require('mongoose').Types;
const _ = require('lodash');

exports.addOrDeleteExemption = async (data) => (data.checked
  ? createExemption(_.omit(data, ['checked', 'symbol']))
  : removeExemption(_.omit(data, ['checked', 'symbol'])));

const createExemption = async (data) => {
  if (data.recordId) data.recordId = new ObjectId(data.recordId);
  const { result, error } = await walletExemptionsModel.updateOne(data, data);
  if (error) return { error };
  return { result: !!result };
};

const removeExemption = async (exemption) => {
  const { result, error } = await walletExemptionsModel.deleteOne(exemption);

  if (error) return { error };
  return { result: !!result };
};
