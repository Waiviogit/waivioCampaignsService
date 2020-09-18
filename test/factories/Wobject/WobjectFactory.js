const { faker, Wobject } = require('test/testHelper');
const ObjectTypeFactory = require('test/factories/ObjectTypeFactory/ObjectTypeFactory');

const Create = async (data = {}) => {
  const dbObjectType = await ObjectTypeFactory.Create(
    { name: data.objectType || faker.random.string() },
  );
  const wobjectData = {
    authority: {
      administrative: data.administrative || [faker.random.string()],
      ownership: data.ownership || [faker.random.string()],
    },
    object_type: dbObjectType.name,
    author: data.author || `${faker.name.firstName()}${faker.random.number()}`,
    creator: data.creator || `${faker.name.firstName()}${faker.random.number()}`,
    default_name: data.default_name || `${faker.name.firstName()}${faker.random.number()}`,
    author_permlink: data.author_permlink || `${faker.name.firstName()}${faker.random.number()}`,
    map: data.coordinates ? { type: 'Point', coordinates: data.coordinates } : undefined,
    fields: data.fields || [],
  };
  const wobject = new Wobject(wobjectData);

  await wobject.save();
  return wobject.toObject();
};

module.exports = { Create };
