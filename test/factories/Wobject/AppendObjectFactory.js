const moment = require('moment');
const _ = require('lodash');
const { ObjectId } = require('mongoose').Types;
const { faker, Wobject } = require('test/testHelper');
const ObjectFactory = require('test/factories/Wobject/WobjectFactory');

const Create = async ({
  creator, name, weight, body, rootWobj, additionalFields = {},
  activeVotes, id, administrative, ownership, timestamp,
} = {}) => {
  const appendObject = {
    _id: objectIdFromDateString(timestamp || moment.utc().valueOf()),
    name: name || 'city',
    body: body || faker.address.city(),
    locale: 'en-US',
    weight: weight || faker.random.number(1000),
    creator: creator || faker.name.firstName().toLowerCase(),
    author: faker.name.firstName().toLowerCase(),
    permlink: faker.random.string(20),
    active_votes: activeVotes || [],
  };
  for (const key in additionalFields) appendObject[key] = additionalFields[key];
  if (id) appendObject.id = id;
  rootWobj = rootWobj || `${faker.random.string(3)}-${faker.address.city().replace(/ /g, '')}`;
  let wobject = await Wobject.findOne({ author_permlink: rootWobj }).lean();

  if (!wobject) {
    wobject = await ObjectFactory.Create({
      author_permlink: rootWobj, fields: [appendObject], administrative, ownership,
    });
  } else {
    await Wobject.updateOne({ author_permlink: rootWobj }, { $addToSet: { fields: appendObject } });
    wobject = await Wobject.findOne({ author_permlink: rootWobj }).lean();
  }
  return { appendObject, rootWobj, wobject };
};

const objectIdFromDateString = (timestamp) => {
  const str = `${Math.floor(timestamp / 1000).toString(16)}${_.random(10000, 99999)}00000000000`;
  return new ObjectId(str);
};

module.exports = { Create, objectIdFromDateString };
