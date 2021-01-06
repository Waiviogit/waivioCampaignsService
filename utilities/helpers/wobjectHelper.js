const _ = require('lodash');
const { getNamespace } = require('cls-hooked');
const { wobjectModel, appModel } = require('models');
const {
  REQUIREDFIELDS_PARENT, MIN_PERCENT_TO_SHOW_UPGATE, FIELDS_NAMES,
  ADMIN_ROLES, categorySwitcher, CAMPAIGN_FIELDS, VOTE_STATUSES, OBJECT_TYPES,
} = require('constants/wobjectsData');

const getSessionApp = async () => {
  const session = getNamespace('request-session');
  const host = session.get('host');
  const { result } = await appModel.findOne(host);
  return result;
};

const calculateApprovePercent = (field) => {
  if (_.isEmpty(field.active_votes)) return 100;
  if (field.adminVote) return field.adminVote.status === VOTE_STATUSES.APPROVED ? 100 : 0;
  if (field.weight < 0) return 0;

  const rejectsWeight = _.sumBy(field.active_votes, (vote) => {
    if (vote.percent < 0) {
      return -(+vote.weight || -1);
    }
  }) || 0;
  const approvesWeight = _.sumBy(field.active_votes, (vote) => {
    if (vote.percent > 0) {
      return +vote.weight || 1;
    }
  }) || 0;
  if (!rejectsWeight) return 100;
  const percent = _.round((approvesWeight / (approvesWeight + rejectsWeight)) * 100, 3);
  return percent > 0 ? percent : 0;
};

/** We have some types of admins at wobject, in this method we find admin role type */
const getFieldVoteRole = (vote) => {
  let role = ADMIN_ROLES.ADMIN;
  vote.ownership ? role = ADMIN_ROLES.OWNERSHIP : null;
  vote.administrative ? role = ADMIN_ROLES.ADMINISTRATIVE : null;
  vote.owner ? role = ADMIN_ROLES.OWNER : null;
  return role;
};

const addDataToFields = ({
  fields, filter, admins, ownership, administrative, owner,
}) => {
  /** Filter, if we need not all fields */
  if (filter) fields = _.filter(fields, (field) => _.includes(filter, field.name));

  for (const field of fields) {
    let adminVote, administrativeVote, ownershipVote, ownerVote;
    _.map(field.active_votes, (vote) => {
      vote.timestamp = vote._id.getTimestamp().valueOf();
      if (vote.voter === owner) {
        vote.owner = true;
        ownerVote = vote;
      } else if (_.includes(admins, vote.voter)) {
        vote.admin = true;
        vote.timestamp > _.get(adminVote, 'timestamp', 0) ? adminVote = vote : null;
      } else if (_.includes(administrative, vote.voter)) {
        vote.administrative = true;
        vote.timestamp > _.get(administrativeVote, 'timestamp', 0) ? administrativeVote = vote : null;
      } else if (_.includes(ownership, vote.voter)) {
        vote.ownership = true;
        vote.timestamp > _.get(ownershipVote, 'timestamp', 0) ? ownershipVote = vote : null;
      }
    });
    field.createdAt = field._id.getTimestamp().valueOf();
    /** If field includes admin votes fill in it */
    if (ownerVote || adminVote || administrativeVote || ownershipVote) {
      const mainVote = ownerVote || adminVote || ownershipVote || administrativeVote;
      field.adminVote = {
        role: getFieldVoteRole(mainVote),
        status: mainVote.percent > 0 ? 'approved' : 'rejected',
        name: mainVote.voter,
        timestamp: mainVote.timestamp,
      };
    }
    field.approvePercent = calculateApprovePercent(field);
  }
  return fields;
};

const specialFieldFilter = (idField, allFields, id) => {
  if (!idField.adminVote && idField.weight < 0) return null;
  idField.items = [];
  const filteredItems = _.filter(allFields[categorySwitcher[id]],
    (item) => item.id === idField.id && _.get(item, 'adminVote.status') !== 'rejected');

  for (const itemField of filteredItems) {
    if (!idField.adminVote && itemField.weight < 0) continue;
    idField.items.push(itemField);
  }
  if (id === 'tagCategory' && idField.items.length === 0) return null;
  return idField;
};

const arrayFieldFilter = ({
  idFields, allFields, filter, id, permlink,
}) => {
  const validFields = [];
  for (const field of idFields) {
    if (_.get(field, 'adminVote.status') === 'rejected') continue;
    switch (id) {
      case FIELDS_NAMES.TAG_CATEGORY:
      case FIELDS_NAMES.GALLERY_ALBUM:
        validFields.push(specialFieldFilter(field, allFields, id));
        break;
      case FIELDS_NAMES.RATING:
      case FIELDS_NAMES.PHONE:
      case FIELDS_NAMES.BUTTON:
      case FIELDS_NAMES.BLOG:
      case FIELDS_NAMES.FORM:
      case FIELDS_NAMES.GALLERY_ITEM:
      case FIELDS_NAMES.LIST_ITEM:
        if (_.includes(filter, FIELDS_NAMES.GALLERY_ALBUM)) break;
        if (_.get(field, 'adminVote.status') === VOTE_STATUSES.APPROVED) validFields.push(field);
        else if (field.weight > 0 && field.approvePercent > MIN_PERCENT_TO_SHOW_UPGATE) {
          validFields.push(field);
        }
        break;
      default:
        break;
    }
  }
  if (id === FIELDS_NAMES.GALLERY_ALBUM ) {
    const noAlbumItems = _.filter(allFields[categorySwitcher[id]],
      (item) => item.id === permlink && _.get(item, 'adminVote.status') !== VOTE_STATUSES.REJECTED);
    if (noAlbumItems.length)validFields.push({ items: noAlbumItems, body: 'Photos' });
  }
  return _.compact(validFields);
};

const filterFieldValidation = (filter, field, locale, ownership) => {
  field.locale === 'auto' ? field.locale = 'en-US' : null;
  const localeIndependentFields = ['status', 'map', 'parent'];
  let result = _.includes(localeIndependentFields, field.name) || locale === field.locale;
  if (filter) result = result && _.includes(filter, field.name);
  if (ownership) {
    result = result && _.includes(
      [ADMIN_ROLES.OWNERSHIP, ADMIN_ROLES.ADMIN, ADMIN_ROLES.OWNER], _.get(field, 'adminVote.role'),
    );
  }
  return result;
};

const getFieldsToDisplay = (fields, locale, filter, permlink, ownership) => {
  locale = locale === 'auto' ? 'en-US' : locale;
  const arrayFields = ['categoryItem', 'listItem', 'tagCategory', 'galleryAlbum', 'galleryItem', 'rating', 'button', 'phone'];
  const winningFields = {};
  const filteredFields = _.filter(fields,
    (field) => filterFieldValidation(filter, field, locale, ownership));
  if (!filteredFields.length) return {};

  const groupedFields = _.groupBy(filteredFields, 'name');
  for (const id of Object.keys(groupedFields)) {
    const approvedFields = _.filter(groupedFields[id],
      (field) => _.get(field, 'adminVote.status') === 'approved');

    if (_.includes(arrayFields, id)) {
      const result = arrayFieldFilter({
        idFields: groupedFields[id], allFields: groupedFields, filter, id, permlink,
      });
      if (result.length)winningFields[id] = result;
      continue;
    }

    if (approvedFields.length) {
      const ownerVotes = _.filter(approvedFields,
        (field) => field.adminVote.role === ADMIN_ROLES.OWNER);
      const adminVotes = _.filter(approvedFields,
        (field) => field.adminVote.role === ADMIN_ROLES.ADMIN);
      if (ownerVotes.length) winningFields[id] = _.maxBy(ownerVotes, 'adminVote.timestamp').body;
      else if (adminVotes.length) winningFields[id] = _.maxBy(adminVotes, 'adminVote.timestamp').body;
      else winningFields[id] = _.maxBy(approvedFields, 'adminVote.timestamp').body;
      continue;
    }
    const heaviestField = _.maxBy(groupedFields[id], (field) => {
      if (_.get(field, 'adminVote.status') !== 'rejected' && field.weight > 0
                && field.approvePercent > MIN_PERCENT_TO_SHOW_UPGATE) return field.weight;
    });
    if (heaviestField) winningFields[id] = heaviestField.body;
  }
  return winningFields;
};

const getLinkToPageLoad = (obj) => {
  let listItem = _.get(obj, 'listItem', []);
  if (!_.get(obj, 'sortCustom', []).length) {
    switch (obj.object_type) {
      case OBJECT_TYPES.PAGE:
        return `/object/${obj.author_permlink}/page`;
      case OBJECT_TYPES.LIST:
        return `/object/${obj.author_permlink}/list`;
      case OBJECT_TYPES.BUSINESS:
      case OBJECT_TYPES.PRODUCT:
      case OBJECT_TYPES.SERVICE:
      case OBJECT_TYPES.COMPANY:
      case OBJECT_TYPES.PERSON:
      case OBJECT_TYPES.PLACE:
      case OBJECT_TYPES.HOTEL:
      case OBJECT_TYPES.RESTAURANT:
        if (listItem.length) {
          _.find(listItem, (list) => list.type === 'menuList')
            ? listItem = _.filter(listItem, (list) => list.type === 'menuList')
            : null;
          const item = _
            .chain(listItem)
            .orderBy([(list) => _.get(list, 'adminVote.timestamp', 0), 'weight'], ['desc', 'desc'])
            .first()
            .value();
          return `/object/${obj.author_permlink}/${item.type === 'menuPage' ? 'page' : 'menu'}#${item.body}`;
        }
        return `/object/${obj.author_permlink}`;
      default:
        return `/object/${obj.author_permlink}`;
    }
  }
  if (obj.object_type === OBJECT_TYPES.LIST) return `/object/${obj.author_permlink}/list`;
  const field = _.find(listItem, { body: obj.sortCustom[0] });
  if (!field) return `/object/${obj.author_permlink}`;
  return `/object/${obj.author_permlink}/${field.type === 'menuPage' ? 'page' : 'menu'}#${field.body}`;
};

const getTopTags = (obj) => {
  const tagCategories = _.get(obj, 'tagCategory', []);
  if (_.isEmpty(tagCategories)) return [];
  let tags = [];
  for (const tagCategory of tagCategories) {
    tags = _.concat(tags, tagCategory.items);
  }
  return _
    .chain(tags)
    .orderBy('weight', 'desc')
    .slice(0, 2)
    .map('body')
    .value();
};

/** Parse wobjects to get its winning */
const processWobjects = async ({
  wobjects, fields, locale = 'en-US',
  app, returnArray = true,
}) => {
  const filteredWobj = [];
  if (!_.isArray(wobjects)) return filteredWobj;
  const admins = _.get(app, 'admins', []);
  await Promise.all(wobjects.map(async (obj) => {
    /** Get app admins, wobj administrators, which was approved by app owner(creator) */
    const ownership = _.intersection(
      _.get(obj, 'authority.ownership', []), _.get(app, 'authority', []),
    );
    const administrative = _.intersection(
      _.get(obj, 'authority.administrative', []), _.get(app, 'authority', []),
    );

    obj.fields = addDataToFields({
      fields: obj.fields, filter: fields, admins, ownership, administrative, owner: _.get(app, 'owner'),
    });
    /** Omit map, because wobject has field map, temp solution? maybe field map in wobj not need */
    obj = _.omit(obj, ['map']);
    Object.assign(obj,
      getFieldsToDisplay(obj.fields, locale, fields, obj.author_permlink, !!ownership.length));
    obj = _.omit(obj, ['fields', 'latest_posts', 'last_posts_counts_by_hours', 'tagCategories']);
    if (obj.sortCustom && typeof obj.sortCustom === 'string') obj.sortCustom = JSON.parse(obj.sortCustom);
    obj.defaultShowLink = getLinkToPageLoad(obj);
    if (_.has(obj, FIELDS_NAMES.TAG_CATEGORY)) obj.topTags = getTopTags(obj);
    filteredWobj.push(obj);
  }));
  if (!returnArray) return filteredWobj[0];
  return filteredWobj;
};

/** Get wobject data for campaigns */
const getWobjects = async ({
  campaigns, locale, appName, forSecondary = true, needProcess = true,
}) => {
  const objects = _.flattenDeep(
    _.concat(
      _.map(campaigns, 'requiredObject'), forSecondary && needProcess ? _.map(campaigns, 'objects') : [],
    ),
  );

  const session = getNamespace('request-session');
  const host = session.get('host');
  const { result: app } = await appModel.findOne(host);

  let { result: wobjects } = await wobjectModel.find(
    { author_permlink: { $in: _.uniq(objects) } },
  );
  if (needProcess) {
    wobjects = await processWobjects({
      wobjects, locale, fields: CAMPAIGN_FIELDS, app,
    });
    let { result: parents } = await wobjectModel.find(
      { author_permlink: { $in: _.uniq(_.compact(_.map(wobjects, 'parent'))) } },
    );
    parents = await processWobjects({
      wobjects: parents, locale, fields: REQUIREDFIELDS_PARENT, app,
    });
    wobjects.forEach((wobj) => {
      if (wobj.parent) wobj.parent = _.find(parents, { author_permlink: wobj.parent });
    });
  }

  return { wobjects };
};

const getWobjectName = async (permlink) => {
  const { result: wobject } = await wobjectModel.findOne(permlink);
  const app = await getSessionApp();
  const processedWobj = await processWobjects({
    wobjects: [wobject],
    fields: [FIELDS_NAMES.NAME],
    app,
    returnArray: false,
  });
  return { objectName: processedWobj.name || wobject.default_name };
};

module.exports = {
  processWobjects, getWobjects, getWobjectName, getSessionApp, getTopTags, getLinkToPageLoad,
};
