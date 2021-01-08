const {
  detectFraudHelper, expect, sinon, faker, _, moment,
} = require('test/testHelper');
const { GPS_DIFF } = require('constants/constants');
const { handleImagesData } = require('./mocks');

describe('On detectFraudHelper', async () => {
  let fraud, fraudCodes, handleImages;
  const latitude = faker.address.latitude();
  const longitude = faker.address.longitude();
  afterEach(() => {
    sinon.restore();
  });
  it('should fraud false and empty codes on empty params', async () => {
    ({ fraud, fraudCodes } = await detectFraudHelper.detectFraudInReview());
    expect({ fraud, fraudCodes }).to.be.deep.eq({ fraud: false, fraudCodes: [] });
  });
  describe('On no exif data', async () => {
    beforeEach(async () => {
      handleImages = handleImagesData();
      await sinon.stub(detectFraudHelper, 'handleImages').returns(Promise.resolve(handleImages));
      ({ fraud, fraudCodes } = await detectFraudHelper
        .detectFraudInReview([faker.random.string()], { reservedAt: new Date() }));
    });
    it('should fraud be true', async () => {
      expect(fraud).to.be.true;
    });
    it('should fraudArray begin with proper number', async () => {
      const [code] = fraudCodes;
      expect(code.slice(0, 2)).to.be.eq(process.env.FR_META_ALL);
    });
  });
  describe('On one without exif data', async () => {
    beforeEach(async () => {
      const randomCount = _.random(2, 10);
      const images = [];
      for (let i = 0; i < randomCount; i++) {
        images.push(faker.random.string());
      }
      handleImages = handleImagesData({ exifCounter: randomCount - 1 });
      await sinon.stub(detectFraudHelper, 'handleImages').returns(Promise.resolve(handleImages));
      ({ fraud, fraudCodes } = await detectFraudHelper
        .detectFraudInReview(images, { reservedAt: new Date() }));
    });
    it('should fraud be false', async () => {
      expect(fraud).to.be.true;
    });
    it('should fraudArray begin with proper number', async () => {
      const [code] = fraudCodes;
      expect(code.slice(0, 2)).to.be.eq(process.env.FR_META_ONE);
    });
  });
  describe('On resolution fraud', async () => {
    beforeEach(async () => {
      handleImages = handleImagesData({ photoWidth: [1920, 1000], exifCounter: 1 });
    });
    it('should fraud be true', async () => {
      await sinon.stub(detectFraudHelper, 'handleImages').returns(Promise.resolve(handleImages));
      ({ fraud, fraudCodes } = await detectFraudHelper
        .detectFraudInReview([faker.random.string()], { reservedAt: new Date() }));
      expect(fraud).to.be.true;
    });
    it('should fraudArray begin with proper number', async () => {
      await sinon.stub(detectFraudHelper, 'handleImages').returns(Promise.resolve(handleImages));
      ({ fraud, fraudCodes } = await detectFraudHelper
        .detectFraudInReview([faker.random.string()], { reservedAt: new Date() }));
      const [code] = fraudCodes;
      expect(code.slice(0, 2)).to.be.eq(process.env.FR_RESOLUTION);
    });
    it('should fraudArray to be empty on valid resolutions', async () => {
      handleImages = handleImagesData({ photoWidth: [1920, 1080, 1920], exifCounter: 1 });
      await sinon.stub(detectFraudHelper, 'handleImages').returns(Promise.resolve(handleImages));
      ({ fraud, fraudCodes } = await detectFraudHelper
        .detectFraudInReview([faker.random.string()], { reservedAt: new Date() }));

      expect(fraudCodes).to.be.an('array').that.is.empty;
    });
  });
  describe('On different date on photos', async () => {
    beforeEach(async () => {
      handleImages = handleImagesData({
        photoDates: [
          Math.round(moment().subtract(_.random(2, 13), 'days').valueOf() / 1000),
          Math.round(moment().valueOf() / 1000),
        ],
        exifCounter: 1,
      });
    });
    it('should fraud be true', async () => {
      await sinon.stub(detectFraudHelper, 'handleImages').returns(Promise.resolve(handleImages));
      ({ fraud, fraudCodes } = await detectFraudHelper
        .detectFraudInReview([faker.random.string()], { reservedAt: new Date() }));
      expect(fraud).to.be.true;
    });
    it('should fraudArray begin with proper number', async () => {
      await sinon.stub(detectFraudHelper, 'handleImages').returns(Promise.resolve(handleImages));
      ({ fraud, fraudCodes } = await detectFraudHelper
        .detectFraudInReview([faker.random.string()], { reservedAt: new Date() }));
      const [code] = fraudCodes;
      expect(code.slice(0, 2)).to.be.eq(process.env.FR_DATE);
    });
    it('should fraudArray to be empty on valid date', async () => {
      handleImages = handleImagesData({
        photoDates: [
          Math.round(moment().valueOf() / 1000),
          Math.round(moment().valueOf() / 1000),
        ],
        exifCounter: 1,
      });
      await sinon.stub(detectFraudHelper, 'handleImages').returns(Promise.resolve(handleImages));
      ({ fraud, fraudCodes } = await detectFraudHelper
        .detectFraudInReview([faker.random.string()], { reservedAt: new Date() }));

      expect(fraudCodes).to.be.an('array').that.is.empty;
    });
  });
  describe('On different date with reservation date', async () => {
    beforeEach(async () => {
      handleImages = handleImagesData({
        photoDates: [Math.round(moment().subtract(_.random(15, 20), 'days').valueOf() / 1000)],
        exifCounter: 1,
      });
    });
    it('should fraud be true', async () => {
      await sinon.stub(detectFraudHelper, 'handleImages').returns(Promise.resolve(handleImages));
      ({ fraud, fraudCodes } = await detectFraudHelper
        .detectFraudInReview([faker.random.string()], { reservedAt: new Date() }));
      expect(fraud).to.be.true;
    });
    it('should fraudArray begin with proper number', async () => {
      await sinon.stub(detectFraudHelper, 'handleImages').returns(Promise.resolve(handleImages));
      ({ fraud, fraudCodes } = await detectFraudHelper
        .detectFraudInReview([faker.random.string()], { reservedAt: new Date() }));
      const [code] = fraudCodes;
      expect(code.slice(0, 2)).to.be.eq(process.env.FR_DATE_RW);
    });
    it('should fraudArray to be empty on valid date', async () => {
      handleImages = handleImagesData({
        photoDates: [Math.round(moment().valueOf() / 1000)],
        exifCounter: 1,
      });
      await sinon.stub(detectFraudHelper, 'handleImages').returns(Promise.resolve(handleImages));
      ({ fraud, fraudCodes } = await detectFraudHelper
        .detectFraudInReview([faker.random.string()], { reservedAt: new Date() }));

      expect(fraudCodes).to.be.an('array').that.is.empty;
    });
  });
  describe('On different models', async () => {
    beforeEach(async () => {
      handleImages = handleImagesData({
        models: [faker.random.string(), faker.random.string()],
        exifCounter: 1,
      });
    });
    it('should fraud be true', async () => {
      await sinon.stub(detectFraudHelper, 'handleImages').returns(Promise.resolve(handleImages));
      ({ fraud, fraudCodes } = await detectFraudHelper
        .detectFraudInReview([faker.random.string()], { reservedAt: new Date() }));
      expect(fraud).to.be.true;
    });
    it('should fraudArray begin with proper number', async () => {
      await sinon.stub(detectFraudHelper, 'handleImages').returns(Promise.resolve(handleImages));
      ({ fraud, fraudCodes } = await detectFraudHelper
        .detectFraudInReview([faker.random.string()], { reservedAt: new Date() }));
      const [code] = fraudCodes;
      expect(code.slice(0, 2)).to.be.eq(process.env.FR_ID_DIFF);
    });
    it('should fraudArray to be empty on valid date', async () => {
      handleImages = handleImagesData({
        models: [faker.random.string()],
        exifCounter: 1,
      });
      await sinon.stub(detectFraudHelper, 'handleImages').returns(Promise.resolve(handleImages));
      ({ fraud, fraudCodes } = await detectFraudHelper
        .detectFraudInReview([faker.random.string()], { reservedAt: new Date() }));
      expect(fraudCodes).to.be.an('array').that.is.empty;
    });
  });
  describe('On different gps on photos', async () => {
    beforeEach(async () => {
      handleImages = handleImagesData({
        latitudeArr: [+latitude, +latitude + _.random(0.02, 100)],
        LongitudeArr: [+longitude, +longitude + _.random(0.02, 100)],
        exifCounter: 1,
      });
    });
    it('should fraud be true', async () => {
      await sinon.stub(detectFraudHelper, 'handleImages').returns(Promise.resolve(handleImages));
      ({ fraud, fraudCodes } = await detectFraudHelper
        .detectFraudInReview([faker.random.string()], { reservedAt: new Date() }));
      expect(fraud).to.be.true;
    });
    it('should fraudArray begin with proper number', async () => {
      await sinon.stub(detectFraudHelper, 'handleImages').returns(Promise.resolve(handleImages));
      ({ fraud, fraudCodes } = await detectFraudHelper
        .detectFraudInReview([faker.random.string()], { reservedAt: new Date() }));
      const [code, code2] = fraudCodes;
      expect([code.slice(0, 2), code2.slice(0, 2)])
        .to.be.deep.eq([process.env.FR_GPS_DIFF, process.env.FR_GPS_1]);
    });
    it('should fraudArray to be empty on valid date', async () => {
      handleImages = handleImagesData({
        latitudeArr: [+latitude, +latitude + _.random(0.001, GPS_DIFF)],
        LongitudeArr: [+longitude, +longitude + _.random(0.001, GPS_DIFF)],
        exifCounter: 1,
      });
      await sinon.stub(detectFraudHelper, 'handleImages').returns(Promise.resolve(handleImages));
      ({ fraud, fraudCodes } = await detectFraudHelper
        .detectFraudInReview([faker.random.string()], { reservedAt: new Date() }));
      expect(fraudCodes).to.be.an('array').that.is.empty;
    });
  });
  describe('On different gps on photos and object map', async () => {
    let map = {
      latitude: +latitude + _.random(0.02, 100),
      longitude: +longitude + _.random(0.02, 100),
    };
    beforeEach(async () => {
      handleImages = handleImagesData({
        latitudeArr: [+latitude],
        LongitudeArr: [+longitude],
        exifCounter: 1,
      });
    });
    it('should fraud be true', async () => {
      await sinon.stub(detectFraudHelper, 'handleImages').returns(Promise.resolve(handleImages));
      await sinon.stub(detectFraudHelper, 'getMap').returns(Promise.resolve({ map }));
      ({ fraud, fraudCodes } = await detectFraudHelper
        .detectFraudInReview([faker.random.string()], { reservedAt: new Date() }));
      expect(fraud).to.be.true;
    });
    it('should fraudArray begin with proper number', async () => {
      await sinon.stub(detectFraudHelper, 'handleImages').returns(Promise.resolve(handleImages));
      await sinon.stub(detectFraudHelper, 'getMap').returns(Promise.resolve({ map }));
      ({ fraud, fraudCodes } = await detectFraudHelper
        .detectFraudInReview([faker.random.string()], { reservedAt: new Date() }));
      const [code] = fraudCodes;
      expect(code.slice(0, 2)).to.be.eq(process.env.FR_GPS_1);
    });
    it('should fraudArray to be empty on valid date', async () => {
      map = {
        latitude: +latitude + _.random(0.001, GPS_DIFF),
        longitude: +longitude + _.random(0.001, GPS_DIFF),
      };
      await sinon.stub(detectFraudHelper, 'handleImages').returns(Promise.resolve(handleImages));
      await sinon.stub(detectFraudHelper, 'getMap').returns(Promise.resolve({ map }));
      ({ fraud, fraudCodes } = await detectFraudHelper
        .detectFraudInReview([faker.random.string()], { reservedAt: new Date() }));
      expect(fraudCodes).to.be.an('array').that.is.empty;
    });
  });
});
