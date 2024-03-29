const moment = require('moment');
const _ = require('lodash');
const sinon = require('sinon');
const { DEVICE } = require('constants/constants');
const { getNamespace } = require('cls-hooked');
const {
  faker, dropDatabase, expect, wobjectHelper, Wobject,
} = require('test/testHelper');
const { AppFactory, AppendObjectFactory } = require('test/factories');
const { FIELDS_NAMES, OBJECT_TYPES } = require('constants/wobjectsData');

describe('On wobjectHelper', async () => {
  let app, admin, admin2, administrative, ownership;
  beforeEach(async () => {
    await dropDatabase();
    admin = faker.name.firstName();
    admin2 = faker.name.firstName();
    administrative = faker.name.firstName();
    ownership = faker.name.firstName();
    app = await AppFactory.Create({
      admins: [admin, admin2],
      authority: [ownership, administrative],
    });
  });
  describe('On owner vote', async () => {
    describe('On owner & admin upvote', async () => {
      let object, result, body1, body2;
      beforeEach(async () => {
        body1 = faker.random.string();
        body2 = faker.random.string();
        const name = FIELDS_NAMES.NAME;
        ({ wobject: object } = await AppendObjectFactory.Create({
          name,
          body: body1,
          activeVotes: [{
            voter: admin,
            percent: 100,
            weight: 301,
            _id: AppendObjectFactory.objectIdFromDateString(moment.utc().valueOf()),
          }],
        }));
        ({ wobject: object } = await AppendObjectFactory.Create({
          name,
          body: body2,
          rootWobj: object.author_permlink,
          activeVotes: [{
            voter: app.owner,
            percent: 100,
            weight: 301,
            _id: AppendObjectFactory.objectIdFromDateString(moment.utc().subtract(5, 'day').valueOf()),
          }],
        }));
        result = await wobjectHelper.processWobjects({
          wobjects: [_.cloneDeep(object)], app, returnArray: false, hiveData: true,
        });
      });
      it('should return name which was upvoted by owner', async () => {
        expect(result[FIELDS_NAMES.NAME]).to.be.eq(body2);
      });
    });
    describe('On owner downvote& admin upvote', async () => {
      let object, result, body;
      beforeEach(async () => {
        body = faker.random.string();

        const name = FIELDS_NAMES.NAME;
        ({ wobject: object } = await AppendObjectFactory.Create({
          name,
          body,
          activeVotes: [{
            voter: admin,
            percent: 100,
            weight: 301,
            _id: AppendObjectFactory.objectIdFromDateString(moment.utc().valueOf()),
          }, {
            voter: app.owner,
            percent: -100,
            weight: -301,
            _id: AppendObjectFactory.objectIdFromDateString(moment.utc().subtract(5, 'day').valueOf()),
          }],
        }));
        result = await wobjectHelper.processWobjects({
          wobjects: [_.cloneDeep(object)], app, returnArray: false, hiveData: true,
        });
      });
      it('should return name which was upvoted by owner', async () => {
        expect(result[FIELDS_NAMES.NAME]).to.be.undefined;
      });
    });
  });
  describe('getUpdates without adminVotes and filters', async () => {
    let object, body, result;
    beforeEach(async () => {
      body = faker.image.imageUrl();
      ({ wobject: object } = await AppendObjectFactory.Create(
        { weight: 1, name: FIELDS_NAMES.AVATAR, body },
      ));
      result = await wobjectHelper.processWobjects({ wobjects: [object], app, returnArray: false });
    });
    it('should return correct field if weight > 0 and no downvotes', async () => {
      expect(result[FIELDS_NAMES.AVATAR]).to.be.eq(body);
    });
  });

  describe('getUpdates without adminVotes and with filters', async () => {
    let object, body, result;
    beforeEach(async () => {
      body = faker.image.imageUrl();
      ({ wobject: object } = await AppendObjectFactory.Create(
        { weight: 1, name: FIELDS_NAMES.AVATAR, body },
      ));
      ({ wobject: object } = await AppendObjectFactory.Create(
        { weight: 1, name: FIELDS_NAMES.ADDRESS, rootWobj: object.author_permlink },
      ));
      result = await wobjectHelper.processWobjects({
        wobjects: [_.cloneDeep(object)], app, returnArray: false, fields: [FIELDS_NAMES.ADDRESS],
      });
    });
    it('return field which set in filter', async () => {
      expect(result[FIELDS_NAMES.ADDRESS]).to.be.exist;
    });
    it('should not return another object field', async () => {
      expect(result[FIELDS_NAMES.AVATAR]).to.not.exist;
    });
  });

  describe('On object tag categories elements without adminVotes and with filters', async () => {
    let object, id, result, body;
    beforeEach(async () => {
      body = faker.random.string();
      id = faker.random.string();
      ({ wobject: object } = await AppendObjectFactory.Create(
        { weight: 1, name: FIELDS_NAMES.TAG_CATEGORY, id },
      ));
      await AppendObjectFactory.Create(
        { weight: 1, name: FIELDS_NAMES.TAG_CATEGORY, id: faker.random.string() },
      );
      ({ wobject: object } = await AppendObjectFactory.Create({
        weight: 1, name: FIELDS_NAMES.CATEGORY_ITEM, rootWobj: object.author_permlink, id, body,
      }));
      result = await wobjectHelper.processWobjects({
        wobjects: [_.cloneDeep(object)], app, returnArray: false,
      });
    });
    it('should not return category item field', async () => {
      expect(result[FIELDS_NAMES.CATEGORY_ITEM]).to.not.exist;
    });
    it('should add category item to tag category', async () => {
      const tagCategory = result[FIELDS_NAMES.TAG_CATEGORY];
      const item = _.find(tagCategory[0].items, (itm) => itm.body === body);
      expect(item).to.be.exist;
    });
  });

  describe('On object gallery items without adminVotes and with filters, and one downvoted', async () => {
    let object, id, result, body;
    beforeEach(async () => {
      const permlink = faker.random.string();
      const name = FIELDS_NAMES.GALLERY_ITEM;
      body = faker.random.string();
      id = faker.random.string();
      ({ wobject: object } = await AppendObjectFactory.Create({
        weight: 1, name, id: permlink, rootWobj: permlink,
      }));
      await AppendObjectFactory.Create({
        weight: _.random(10, 100), name, id: permlink, rootWobj: permlink,
      });
      ({ wobject: object } = await AppendObjectFactory.Create({
        weight: _.random(-1, -100), name, rootWobj: permlink, id, body,
      }));
      result = await wobjectHelper.processWobjects({
        wobjects: [_.cloneDeep(object)], app, returnArray: false,
      });
    });
    it('should not return gallery album if it not exist', async () => {
      expect(result[FIELDS_NAMES.GALLERY_ALBUM]).to.be.undefined;
    });
  });

  describe('On object gallery albums without adminVotes and with filters', async () => {
    let object, id, result, body;
    beforeEach(async () => {
      body = faker.random.string();
      id = faker.random.string();
      const name = FIELDS_NAMES.GALLERY_ALBUM;
      ({ wobject: object } = await AppendObjectFactory.Create({
        weight: 1, name, id,
      }));
      await AppendObjectFactory.Create({
        weight: 1, name, id: faker.random.string(), rootWobj: object.author_permlink,
      });
      ({ wobject: object } = await AppendObjectFactory.Create({
        weight: 1, name: FIELDS_NAMES.GALLERY_ITEM, rootWobj: object.author_permlink, id, body,
      }));
      result = await wobjectHelper.processWobjects({
        fields: [name, FIELDS_NAMES.GALLERY_ITEM],
        wobjects: [_.cloneDeep(object)],
        returnArray: false,
        app,
      });
    });
    it('should not return gallery item field', async () => {
      expect(result[FIELDS_NAMES.GALLERY_ITEM]).to.not.exist;
    });
    it('should add gallery item to gallery album', async () => {
      const tagCategory = result[FIELDS_NAMES.GALLERY_ALBUM];
      const item = _.find(tagCategory[0].items, (itm) => itm.body === body);
      expect(item).to.be.exist;
    });
    it('should return gallery album without elements', async () => {
      const albums = result[FIELDS_NAMES.GALLERY_ALBUM];
      expect(albums.length).to.be.eq(2);
    });
  });

  describe('On another array fields, with downvotes', async () => {
    let object, result, body;
    beforeEach(async () => {
      body = faker.random.string();
      const name = FIELDS_NAMES.BUTTON;
      ({ wobject: object } = await AppendObjectFactory.Create({ weight: 1, name }));
      await AppendObjectFactory.Create({
        weight: _.random(-1, -100), name, rootWobj: object.author_permlink,
      });
      await AppendObjectFactory.Create({
        weight: 1,
        body,
        name,
        rootWobj: object.author_permlink,
        activeVotes: [
          { voter: faker.random.string(), percent: -100, weight: -1 },
          { voter: faker.random.string(), percent: 100, weight: 1 },
        ],
      });
      ({ wobject: object } = await AppendObjectFactory.Create({
        weight: 1, name, rootWobj: object.author_permlink,
      }));
      result = await wobjectHelper.processWobjects({
        wobjects: [_.cloneDeep(object)], returnArray: false, app,
      });
    });
    it('should return correct length of elements', async () => {
      expect(result[FIELDS_NAMES.BUTTON].length).to.be.eq(2);
    });
  });

  describe('With only downvotes on field', async () => {
    let object, result, body;
    beforeEach(async () => {
      const name = FIELDS_NAMES.ADDRESS;
      body = faker.random.string();
      ({ wobject: object } = await AppendObjectFactory.Create({
        weight: -1,
        name,
        body,
        activeVotes: [{ voter: faker.random.string(), percent: -100, weight: -1 }],
      }));
      result = await wobjectHelper.processWobjects({
        wobjects: [_.cloneDeep(object)], app, returnArray: false,
      });
    });
    it('should not return field to show with downvotes', async () => {
      expect(result[FIELDS_NAMES.ADDRESS]).to.be.undefined;
    });
  });

  describe('with not array admin vote on negative weight field', async () => {
    let object, result, body;
    beforeEach(async () => {
      const name = FIELDS_NAMES.ADDRESS;
      body = faker.random.string();
      ({ wobject: object } = await AppendObjectFactory.Create({
        weight: -99,
        name,
        body,
        activeVotes: [{ voter: faker.random.string(), percent: -100, weight: -100 },
          { voter: admin, percent: 100, weight: 1 }],
      }));
      ({ wobject: object } = await AppendObjectFactory.Create(
        { weight: 1, name, rootWobj: object.author_permlink },
      ));
      result = await wobjectHelper.processWobjects({
        wobjects: [_.cloneDeep(object)], app, returnArray: false,
      });
    });
    it('should add field to wobject', async () => {
      expect(result[FIELDS_NAMES.ADDRESS]).to.be.eq(body);
    });
  });

  describe('with not array administrative vote on negative weight field', async () => {
    let object, result, body;
    beforeEach(async () => {
      const name = FIELDS_NAMES.ADDRESS;
      body = faker.random.string();
      ({ wobject: object } = await AppendObjectFactory.Create({
        weight: -500,
        name,
        body,
        administrative: [administrative],
        activeVotes: [{ voter: faker.random.string(), percent: -100, weight: -501 },
          { voter: administrative, percent: 100, weight: 1 }],
      }));
      ({ wobject: object } = await AppendObjectFactory.Create(
        { weight: 1, name, rootWobj: object.author_permlink },
      ));
      result = await wobjectHelper.processWobjects({
        wobjects: [_.cloneDeep(object)], app, returnArray: false,
      });
    });
    it('should add field to wobject', async () => {
      expect(result[FIELDS_NAMES.ADDRESS]).to.be.eq(body);
    });
  });

  describe('with not array ownership vote on negative weight field, and another fields', async () => {
    let object, result, body;
    beforeEach(async () => {
      const name = FIELDS_NAMES.ADDRESS;
      body = faker.random.string();
      ({ wobject: object } = await AppendObjectFactory.Create({
        weight: -300,
        name,
        body,
        ownership: [ownership],
        activeVotes: [{ voter: faker.random.string(), percent: -100, weight: -301 },
          { voter: ownership, percent: 100, weight: 1 }],
      }));
      ({ wobject: object } = await AppendObjectFactory.Create(
        { weight: 1, name: FIELDS_NAMES.AVATAR, rootWobj: object.author_permlink },
      ));
      ({ wobject: object } = await AppendObjectFactory.Create(
        {
          weight: 1,
          name: FIELDS_NAMES.DESCRIPTION,
          rootWobj: object.author_permlink,
          activeVotes: [
            { voter: admin, percent: 100, weight: 1 }],
        },
      ));
      result = await wobjectHelper.processWobjects({
        wobjects: [_.cloneDeep(object)], app, returnArray: false,
      });
    });
    it('should add field to wobject', async () => {
      expect(result[FIELDS_NAMES.ADDRESS]).to.be.eq(body);
    });
    it('should not add to wobject field without ownership and admin vote', async () => {
      expect(result[FIELDS_NAMES.AVATAR]).to.be.undefined;
    });
  });

  describe('on admin vote and admin downvote', async () => {
    describe('vote later downvote', async () => {
      let object, result, body;
      beforeEach(async () => {
        const name = FIELDS_NAMES.TITLE;
        body = faker.random.string();
        ({ wobject: object } = await AppendObjectFactory.Create({
          name,
          body,
          activeVotes: [{
            voter: admin2,
            percent: -100,
            weight: -301,
            _id: AppendObjectFactory.objectIdFromDateString(moment.utc().subtract(1, 'day').valueOf()),
          }, {
            voter: admin,
            percent: 100,
            weight: 1,
            _id: AppendObjectFactory.objectIdFromDateString(moment.utc().valueOf()),
          }],
        }));
        result = await wobjectHelper.processWobjects({
          wobjects: [_.cloneDeep(object)], app, returnArray: false,
        });
      });
      it('should return need field in object', async () => {
        expect(result[FIELDS_NAMES.TITLE]).to.be.eq(body);
      });
    });
    describe('vote earlier downvote', async () => {
      let object, result, body;
      beforeEach(async () => {
        const name = FIELDS_NAMES.DESCRIPTION;
        body = faker.random.string();
        ({ wobject: object } = await AppendObjectFactory.Create({
          name,
          body,
          activeVotes: [{
            voter: admin2,
            percent: -100,
            weight: -301,
            _id: AppendObjectFactory.objectIdFromDateString(moment.utc().valueOf()),
          }, {
            voter: admin,
            percent: 100,
            weight: 1,
            _id: AppendObjectFactory.objectIdFromDateString(moment.utc().subtract(1, 'day').valueOf()),
          }],
        }));
        result = await wobjectHelper.processWobjects({
          wobjects: [_.cloneDeep(object)], app, returnArray: false,
        });
      });
      it('should not return need field in object', async () => {
        expect(result[FIELDS_NAMES.TITLE]).to.be.undefined;
      });
    });
  });

  describe('same fields with admin votes', async () => {
    let object, result, body1, body2;
    beforeEach(async () => {
      const name = FIELDS_NAMES.NAME;
      body1 = faker.random.string();
      body2 = faker.random.string();
      ({ wobject: object } = await AppendObjectFactory.Create({
        name,
        body: body1,
        activeVotes: [{
          voter: admin,
          percent: 100,
          weight: 301,
          _id: AppendObjectFactory.objectIdFromDateString(moment.utc().valueOf()),
        }],
      }));
      ({ wobject: object } = await AppendObjectFactory.Create({
        name,
        body: body2,
        rootWobj: object.author_permlink,
        activeVotes: [{
          voter: admin2,
          percent: 100,
          weight: 301,
          _id: AppendObjectFactory.objectIdFromDateString(moment.utc().subtract(1, 'day').valueOf()),
        }],
      }));
      result = await wobjectHelper.processWobjects({
        wobjects: [_.cloneDeep(object)], app, returnArray: false,
      });
    });
    it('should win field with latest admin vote', async () => {
      expect(result[FIELDS_NAMES.NAME]).to.be.eq(body1);
    });
  });

  describe('on admin and administrative actions', async () => {
    describe('On admin vote and administrative vote', async () => {
      let object, result, body;
      beforeEach(async () => {
        const name = FIELDS_NAMES.NAME;
        body = faker.random.string();
        ({ wobject: object } = await AppendObjectFactory.Create({
          name,
          body,
          administrative: [administrative],
          activeVotes: [{
            voter: admin,
            percent: 100,
            weight: 301,
            _id: AppendObjectFactory.objectIdFromDateString(moment.utc().subtract(1, 'day').valueOf()),
          }, {
            voter: administrative,
            percent: 100,
            weight: 500,
            _id: AppendObjectFactory.objectIdFromDateString(moment.utc().valueOf()),
          }],
        }));

        result = await wobjectHelper.processWobjects({
          wobjects: [_.cloneDeep(object)], app, returnArray: false,
        });
      });
      it('should return field which was upvoted by admin', async () => {
        expect(result[FIELDS_NAMES.NAME]).to.be.eq(body);
      });
    });
    describe('On admin downvote and administrative vote', async () => {
      let object, result, body;
      beforeEach(async () => {
        const name = FIELDS_NAMES.STATUS;
        body = faker.random.string();
        ({ wobject: object } = await AppendObjectFactory.Create({
          name,
          administrative: [administrative],
          body,
          activeVotes: [{
            voter: admin,
            percent: -100,
            weight: -1000,
            _id: AppendObjectFactory.objectIdFromDateString(moment.utc().subtract(10, 'day').valueOf()),
          }, {
            voter: administrative,
            percent: 100,
            weight: 500,
            _id: AppendObjectFactory.objectIdFromDateString(moment.utc().valueOf()),
          }],
        }));

        result = await wobjectHelper.processWobjects({
          wobjects: [_.cloneDeep(object)], app, returnArray: false,
        });
      });
      it('should return field which was downvoted by admin', async () => {
        expect(result[FIELDS_NAMES.NAME]).to.be.undefined;
      });
    });
  });

  describe('on admin and ownership actions', async () => {
    describe('On admin vote and administrative vote', async () => {
      let object, result, body;
      beforeEach(async () => {
        const name = FIELDS_NAMES.DESCRIPTION;
        body = faker.random.string();
        ({ wobject: object } = await AppendObjectFactory.Create({
          name,
          ownership: [ownership],
          body,
          activeVotes: [{
            voter: admin,
            percent: 100,
            weight: 1,
            _id: AppendObjectFactory.objectIdFromDateString(moment.utc().subtract(1, 'day').valueOf()),
          }, {
            voter: ownership,
            weight: 1,
            percent: 100,
            _id: AppendObjectFactory.objectIdFromDateString(moment.utc().valueOf()),
          }],
        }));

        result = await wobjectHelper.processWobjects({
          wobjects: [_.cloneDeep(object)], app, returnArray: false,
        });
      });
      it('should return field which was upvoted by admin', async () => {
        expect(result[FIELDS_NAMES.DESCRIPTION]).to.be.eq(body);
      });
    });
    describe('On admin downvote and ownership vote', async () => {
      let object, result, body;
      beforeEach(async () => {
        const name = FIELDS_NAMES.TITLE;
        body = faker.random.string();
        ({ wobject: object } = await AppendObjectFactory.Create({
          name,
          body,
          ownership: [ownership],
          activeVotes: [{
            voter: admin,
            percent: -50,
            weight: -100,
            _id: AppendObjectFactory.objectIdFromDateString(moment.utc().subtract(1, 'day').valueOf()),
          }, {
            voter: ownership,
            percent: 100,
            weight: 500,
            _id: AppendObjectFactory.objectIdFromDateString(moment.utc().valueOf()),
          }],
        }));
        result = await wobjectHelper.processWobjects({
          wobjects: [_.cloneDeep(object)], app, returnArray: false,
        });
      });
      it('should return field which was downvoted by admin', async () => {
        expect(result[FIELDS_NAMES.TITLE]).to.be.undefined;
      });
    });
  });

  describe('on administrative actions at object with ownership', async () => {
    let object, result, body;
    beforeEach(async () => {
      const name = FIELDS_NAMES.NAME;
      body = faker.random.string();
      ({ wobject: object } = await AppendObjectFactory.Create({
        name,
        administrative: [administrative],
        ownership: [ownership],
        body,
        activeVotes: [{
          voter: ownership,
          percent: 100,
          weight: 500,
          _id: AppendObjectFactory.objectIdFromDateString(moment.utc().valueOf()),
        }],
      }));
      ({ wobject: object } = await AppendObjectFactory.Create({
        name: FIELDS_NAMES.TITLE,
        body,
        rootWobj: object.author_permlink,
        activeVotes: [{
          voter: administrative,
          percent: 100,
          weight: 500,
          _id: AppendObjectFactory.objectIdFromDateString(moment.utc().valueOf()),
        }],
      }));
      result = await wobjectHelper.processWobjects({
        wobjects: [_.cloneDeep(object)], app, returnArray: false,
      });
    });
    it('should not add field which was not approved by ownership', async () => {
      expect(result[FIELDS_NAMES.TITLE]).to.be.undefined;
    });
    it('should add field which was approved by ownership', async () => {
      expect(result[FIELDS_NAMES.NAME]).to.be.eq(body);
    });
  });

  describe('with another user locale', async () => {
    let object, result, body;
    beforeEach(async () => {
      const name = FIELDS_NAMES.NAME;
      body = faker.random.string();
      ({ wobject: object } = await AppendObjectFactory.Create({
        name,
        body,
        activeVotes: [{
          voter: faker.random.string(),
          percent: 100,
          weight: 500,
          _id: AppendObjectFactory.objectIdFromDateString(moment.utc().valueOf()),
        }],
      }));
      result = await wobjectHelper.processWobjects({
        wobjects: [_.cloneDeep(object)], app, returnArray: false, locale: 'ms-MY',
      });
    });
    it('should get name from field with en-US locale if can\'t find user locale', async () => {
      expect(result[FIELDS_NAMES.NAME]).to.be.eq(body);
    });

    it('should field locale be eq en-US ', async () => {
      const wobject = await Wobject.findOne({ author_permlink: object.author_permlink }).lean();
      expect(wobject.fields[0].locale).to.be.eq('en-US');
    });
  });

  describe('on getTopTags', async () => {
    let object, result, topTags, tag1, tag2;
    beforeEach(async () => {
      const tagCategory = FIELDS_NAMES.TAG_CATEGORY;
      const categoryItem = FIELDS_NAMES.CATEGORY_ITEM;
      const id = faker.random.number();
      tag1 = faker.random.string();
      tag2 = faker.random.string();
      ({ wobject: object } = await AppendObjectFactory.Create({
        name: tagCategory, id, weight: 100,
      }));
      await AppendObjectFactory.Create({
        weight: _.random(100, 200),
        rootWobj: object.author_permlink,
        name: categoryItem,
        body: tag1,
        id,
      });
      ({ wobject: object } = await AppendObjectFactory.Create({
        weight: _.random(1, 99),
        rootWobj: object.author_permlink,
        name: categoryItem,
        body: tag2,
        id,
      }));
      result = await wobjectHelper.processWobjects({
        fields: [FIELDS_NAMES.TAG_CATEGORY, FIELDS_NAMES.CATEGORY_ITEM],
        wobjects: [_.cloneDeep(object)],
        returnArray: false,
        app,
      });
      topTags = wobjectHelper.getTopTags(result);
    });
    it('should return tag with more weight on 0 element of array', async () => {
      expect(topTags[0]).to.be.eq(tag1);
    });
    it('should return tag with less weight on 1 element of array', async () => {
      expect(topTags[1]).to.be.eq(tag2);
    });
  });

  describe('on getLinkToPageLoad', async () => {
    let obj, link, expectedLink, menuList, menuList2, menuPage;

    beforeEach(() => {
      menuList = { type: 'menuList', body: faker.random.string(), weight: _.random(100, 200) };
      menuList2 = { type: 'menuList', body: faker.random.string(), weight: _.random(0, 99) };
      menuPage = { type: 'menuPage', body: faker.random.string() };
    });

    describe('On mobile device', async () => {
      beforeEach(async () => {
        sinon.stub(getNamespace('request-session'), 'get').returns(DEVICE.MOBILE);
      });

      afterEach(() => {
        sinon.restore();
      });

      it('should return /object/author_permlink on hashtag obj type', async () => {
        obj = {
          object_type: OBJECT_TYPES.HASHTAG,
          author_permlink: faker.random.string(),
        };
        expectedLink = `/object/${obj.author_permlink}`;
        link = wobjectHelper.getLinkToPageLoad(obj);
        expect(link).to.be.eq(expectedLink);
      });

      it('should return /object/author_permlink on any obj type except hashtag type', async () => {
        obj = {
          object_type: _.sample(Object.values(_.omit(OBJECT_TYPES, ['HASHTAG']))),
          author_permlink: faker.random.string(),
        };
        expectedLink = `/object/${obj.author_permlink}/about`;
        link = wobjectHelper.getLinkToPageLoad(obj);
        expect(link).to.be.eq(expectedLink);
      });
    });

    it('should return proper link on obj type page', async () => {
      obj = { object_type: OBJECT_TYPES.PAGE, author_permlink: faker.random.string() };
      expectedLink = `/object/${obj.author_permlink}/page`;
      link = wobjectHelper.getLinkToPageLoad(obj);
      expect(link).to.be.eq(expectedLink);
    });

    it('should return proper link on obj type list', async () => {
      obj = { object_type: OBJECT_TYPES.LIST, author_permlink: faker.random.string() };
      expectedLink = `/object/${obj.author_permlink}/list`;
      link = wobjectHelper.getLinkToPageLoad(obj);
      expect(link).to.be.eq(expectedLink);
    });

    it('should return  /object/author_permlink on some obj types', async () => {
      obj = {
        object_type: _.sample(Object.values(_.pick(OBJECT_TYPES, ['HASHTAG', 'DISH', 'DRINK', 'CRYPTO']))),
        author_permlink: faker.random.string(),
      };
      expectedLink = `/object/${obj.author_permlink}`;
      link = wobjectHelper.getLinkToPageLoad(obj);
      expect(link).to.be.eq(expectedLink);
    });

    it('should return menuList with greater weight if wobject does not have sort custom and have both menuList menuPage', async () => {
      obj = {
        object_type: _.sample(Object.values(_.omit(OBJECT_TYPES, ['LIST', 'PAGE', 'HASHTAG', 'DISH', 'DRINK', 'CRYPTO']))),
        author_permlink: faker.random.string(),
        listItem: [menuList, menuList2, menuPage],
      };
      expectedLink = `/object/${obj.author_permlink}/menu#${menuList.body}`;
      link = wobjectHelper.getLinkToPageLoad(obj);
      expect(link).to.be.eq(expectedLink);
    });

    it('should return menuList with admin vote if wobject does not have sort custom and have both menuList menuPage', async () => {
      menuList2.adminVote = { timestamp: _.random(1, 100) };
      obj = {
        object_type: _.sample(Object.values(_.omit(OBJECT_TYPES, ['LIST', 'PAGE', 'HASHTAG', 'DISH', 'DRINK', 'CRYPTO']))),
        author_permlink: faker.random.string(),
        listItem: [menuList, menuList2, menuPage],
      };
      expectedLink = `/object/${obj.author_permlink}/menu#${menuList2.body}`;
      link = wobjectHelper.getLinkToPageLoad(obj);
      expect(link).to.be.eq(expectedLink);
    });

    it('should return menuPage if wobject does not have neither sort custom nor menuList', async () => {
      obj = {
        object_type: _.sample(Object.values(_.omit(OBJECT_TYPES, ['LIST', 'PAGE', 'HASHTAG', 'DISH', 'DRINK', 'CRYPTO']))),
        author_permlink: faker.random.string(),
        listItem: [menuPage],
      };
      expectedLink = `/object/${obj.author_permlink}/page#${menuPage.body}`;
      link = wobjectHelper.getLinkToPageLoad(obj);
      expect(link).to.be.eq(expectedLink);
    });

    it('should return first element of array sortCustom in obj', async () => {
      obj = {
        object_type: _.sample(Object.values(OBJECT_TYPES)),
        author_permlink: faker.random.string(),
        listItem: [menuList, menuPage],
        sortCustom: [menuPage.body],
      };
      expectedLink = `/object/${obj.author_permlink}/page#${menuPage.body}`;
      link = wobjectHelper.getLinkToPageLoad(obj);
      expect(link).to.be.eq(expectedLink);
    });

    it('should return /object/author_permlink if can not find sortCustom in listItem', async () => {
      obj = {
        object_type: _.sample(Object.values(_.omit(OBJECT_TYPES, ['LIST']))),
        author_permlink: faker.random.string(),
        sortCustom: [menuPage.body],
      };
      expectedLink = `/object/${obj.author_permlink}`;
      link = wobjectHelper.getLinkToPageLoad(obj);
      expect(link).to.be.eq(expectedLink);
    });
  });
});
