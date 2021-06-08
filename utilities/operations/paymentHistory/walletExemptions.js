const { walletExemptionsModel } = require('models');
const { ObjectId } = require('mongoose').Types;
const _ = require('lodash');

exports.addOrDeleteExemption = async (data) => (data.checked
  ? createExemption(data)
  : removeExemption(_.omit(data, ['checked'])));

const createExemption = async ({
  userName, userWithExemptions, _id, operationNum,
}) => {
  const { result, error } = await walletExemptionsModel.updateOne(
    { userName, userWithExemptions },
    { $set: _id ? { _id: ObjectId(_id) } : { operationNum } },
  );
  if (error) return { error };
  return { result: !!result };
};

const removeExemption = async (exemption) => {
  const { result, error } = await walletExemptionsModel.deleteOne(exemption);

  if (error) return { error };
  return { result: !!result };
};
