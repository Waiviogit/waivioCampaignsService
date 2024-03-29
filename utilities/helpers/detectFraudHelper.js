const _ = require('lodash');
const axios = require('axios');
const { getNamespace } = require('cls-hooked');
const moment = require('moment');
const exifParser = require('exif-parser');
const { wobjectModel, appModel } = require('models');
const { FIELDS_NAMES } = require('constants/wobjectsData');
const { SECONDS_IN_DAY, GPS_DIFF } = require('constants/constants');
const { processWobjects } = require('utilities/helpers/wobjectHelper');

exports.getMap = async (permlink = '') => {
  let map = {};
  const { result } = await wobjectModel.findOne({ author_permlink: permlink });
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

exports.handleImages = async (images) => {
  const photoWidth = [], photoDates = [], latitudeArr = [], longitudeArr = [], models = [];
  let exifCounter = 0;
  for (const image of images) {
    try {
      const { data } = await axios.get(image, { responseType: 'arraybuffer' });
      const parsedFile = exifParser.create(data).parse();

      const model = _.get(parsedFile, 'tags.Model');
      const ifNotHaveModel = _.has(parsedFile, 'tags.Orientation') ? 'iPhone' : 'unknown';
      const date = _.get(parsedFile, 'tags.DateTimeOriginal');
      const latitude = _.get(parsedFile, 'tags.GPSLatitude');
      const longitude = _.get(parsedFile, 'tags.GPSLongitude');
      const width = _.get(parsedFile, 'tags.ImageWidth', _.get(parsedFile, 'tags.ExifImageWidth'));

      if (date || (latitude && longitude)) exifCounter++;
      if (model || ifNotHaveModel) models.push(model || ifNotHaveModel);
      if (date) photoDates.push(date);
      if (width) photoWidth.push(width);
      if (latitude && longitude) {
        latitudeArr.push(latitude);
        longitudeArr.push(longitude);
      }
    } catch (e) {
      console.error(e.message);
    }
  }

  return {
    exifCounter, photoWidth, photoDates, models, latitudeArr, longitudeArr,
  };
};

exports.detectFraudInReview = async (images = [], campaign) => {
  let fraud = false;
  const fraudCodes = [];
  if (!images.length || _.isEmpty(campaign)) return { fraud, fraudCodes };

  const deadline = Math.round(moment(campaign.reservedAt).subtract(14, 'days').valueOf() / 1000);
  const { map } = await this.getMap(campaign.requiredObject);
  const {
    exifCounter, photoWidth, photoDates, models, latitudeArr, longitudeArr,
  } = await this.handleImages(images);

  if (checkResolution(photoWidth)) {
    fraudCodes.push(`${process.env.FR_RESOLUTION}${_.random(10, 99)}`);
    fraud = true;
  }
  if (!exifCounter) {
    fraudCodes.push(`${process.env.FR_META_ALL}${_.random(10, 99)}`);
    fraud = true;
  }
  if (exifCounter !== 0 && exifCounter === images.length - 1) {
    fraudCodes.push(`${process.env.FR_META_ONE}${_.random(10, 99)}`);
    fraud = true;
  }
  if (checkValues(photoDates, SECONDS_IN_DAY)) {
    fraudCodes.push(`${process.env.FR_DATE}${_.random(10, 99)}`);
    fraud = true;
  }
  if (checkValues(latitudeArr, GPS_DIFF) || checkValues(longitudeArr, GPS_DIFF)) {
    fraudCodes.push(`${process.env.FR_GPS_DIFF}${_.random(10, 99)}`);
    fraud = true;
  }
  if (checkValues([...latitudeArr, map.latitude], GPS_DIFF)
    || checkValues([...longitudeArr, map.longitude], GPS_DIFF)) {
    fraudCodes.push(`${process.env.FR_GPS_1}${_.random(10, 99)}`);
    fraud = true;
  }
  if (_.uniq(models).length > 1) {
    fraudCodes.push(`${process.env.FR_ID_DIFF}${_.random(10, 99)}`);
    fraud = true;
  }
  if (!_.isEmpty(photoDates)) {
    if (!_.isEmpty(_.filter(photoDates, (el) => el < deadline))) {
      fraudCodes.push(`${process.env.FR_DATE_RW}${_.random(10, 99)}`);
      fraud = true;
    }
  }
  return { fraud, fraudCodes };
};

const checkValues = (values, controlValue) => {
  for (let i = 0; i < values.length; i++) {
    for (let j = 0; j < values.length; j++) {
      if (i !== j && Math.abs(values[i] - values[j]) > controlValue) {
        return true;
      }
    }
  }
  return false;
};

const checkResolution = (values) => {
  for (let i = 0; i < values.length; i++) {
    for (let j = 0; j < values.length; j++) {
      const check1 = values[i] === (values[j] * 2) / 3;
      const check2 = values[i] === (values[j] * 3) / 2;
      const check3 = values[i] === (values[j] * 3) / 4;
      const check4 = values[i] === (values[j] * 4) / 3;
      const check5 = values[i] === (values[j] * 9) / 16;
      const check6 = values[i] === (values[j] * 16) / 9;
      const check7 = values[i] === values[j];
      const condition = check1 || check2 || check3 || check4 || check5 || check6 || check7;
      if (i !== j && !condition) {
        return true;
      }
    }
  }
  return false;
};
