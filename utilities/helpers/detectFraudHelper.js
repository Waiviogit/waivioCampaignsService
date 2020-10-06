const _ = require('lodash');
const axios = require('axios');
const { getNamespace } = require('cls-hooked');
const moment = require('moment');
const exifParser = require('exif-parser');
const { wobjectModel, appModel } = require('models');
const { FIELDS_NAMES } = require('constants/wobjectsData');
const { processWobjects } = require('utilities/helpers/wobjectHelper');

const getMap = async (permlink = '') => {
  let map = {};
  const { result } = await wobjectModel.findOne(permlink);
  if (!result) return { map };

  const session = getNamespace('request-session');
  const host = session.get('host');
  const { result: app } = await appModel.findOne(host);
  const fields = await processWobjects({
    wobjects: [result], fields: [FIELDS_NAMES.MAP], app, returnArray: false,
  });
  if (_.get(fields, FIELDS_NAMES.MAP)) map = JSON.parse(fields.map);
  return { map };
};

const handleImages = async (images) => {
  const tagsArr = [];
  for (const image of images) {
    try {
      const { data } = await axios.get(image, { responseType: 'arraybuffer' });
      const parsedFile = exifParser.create(data).parse();
      const model = _.get(parsedFile, 'tags.Model');
      const ifNotHaveModel = _.has(parsedFile, 'tags.Orientation') ? 'iPhone' : 'unknown';
      tagsArr.push({
        model: model || ifNotHaveModel,
        date: _.get(parsedFile, 'tags.DateTimeOriginal', 0),
        latitude: _.get(parsedFile, 'tags.GPSLatitude', 0),
        longitude: _.get(parsedFile, 'tags.GPSLongitude', 0),
      });
    } catch (e) {
      console.error(e);
    }
  }
  return { tagsArr };
};

exports.detectFraudInReview = async (images = [], campaign) => {
  if (!images.length) return false;
  const deadline = Math.round(moment(campaign.reservedAt).subtract(14, 'days').valueOf() / 1000);
  const { map } = await getMap(campaign.requiredObject);
  const { tagsArr } = await handleImages(images);

  const checkModels = _.uniqBy(tagsArr, 'model');
  if (checkModels.length > 1) return true;

  for (const item of tagsArr) {
    if (item.date && item.date < deadline) return true;
    if (item.latitude && item.longitude && !_.isEmpty(map)) {
      const lat = +map.latitude + 0.01 > item.latitude && item.latitude > +map.latitude - 0.01;
      const long = +map.longitude + 0.01 > item.longitude && item.longitude > +map.longitude - 0.01;
      if (!lat || !long) return true;
    }
  }
  return false;
};
