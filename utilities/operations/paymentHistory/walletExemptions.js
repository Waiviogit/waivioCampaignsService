const { walletExemptionsModel } = require('models');
const { ObjectId } = require('mongoose').Types;

exports.createExemption = async ({
  userName, userWithExemptions, _id, operationNum,
}) => {
  const { result, error } = await walletExemptionsModel.updateOne(
    { userName, userWithExemptions },
    {
      $addToSet: {
        exemptions: _id
          ? ObjectId(_id)
          : operationNum,
      },
    },
  );
  if (error) return { error };
  return { result: !!result };
};
