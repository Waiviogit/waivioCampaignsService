exports.FIELDS_NAMES = {
  CATEGORY_ITEM: 'categoryItem',
  GALLERY_ALBUM: 'galleryAlbum',
  TAG_CATEGORY: 'tagCategory',
  GALLERY_ITEM: 'galleryItem',
  PAGE_CONTENT: 'pageContent',
  DESCRIPTION: 'description',
  SORT_CUSTOM: 'sortCustom',
  NEWS_FILTER: 'newsFilter',
  BACKGROUND: 'background',
  AUTHORITY: 'authority',
  WORK_TIME: 'workTime',
  TAG_CLOUD: 'tagCloud',
  LIST_ITEM: 'listItem',
  CHART_ID: 'chartid',
  ADDRESS: 'address',
  WEBSITE: 'website',
  RATING: 'rating',
  PARENT: 'parent',
  AVATAR: 'avatar',
  BUTTON: 'button',
  STATUS: 'status',
  TITLE: 'title',
  PHONE: 'phone',
  EMAIL: 'email',
  PRICE: 'price',
  BODY: 'body',
  NAME: 'name',
  LINK: 'link',
  MAP: 'map',
  TAG: 'tag',
};

exports.ADMIN_ROLES = {
  ADMINISTRATIVE: 'administrative',
  OWNERSHIP: 'ownership',
  ADMIN: 'admin',
  OWNER: 'owner',
};

exports.AUTHORITY_FIELD_ENUM = {
  ADMINISTRATIVE: 'administrative',
  OWNERSHIP: 'ownership',
};

exports.OBJECT_TYPES = {
  HASHTAG: 'hashtag',
  LIST: 'list',
  PAGE: 'page',
  RESTAURANT: 'restaurant',
  DISH: 'dish',
  DRINK: 'drink',
  BUSINESS: 'business',
  PRODUCT: 'product',
  SERVICE: 'service',
  COMPANY: 'company',
  PERSON: 'person',
  PLACE: 'place',
  CRYPTO: 'crypto',
  HOTEL: 'hotel',
};

exports.REQUIREDFIELDS = [
  this.FIELDS_NAMES.NAME,
  this.FIELDS_NAMES.AVATAR,
  this.FIELDS_NAMES.WEBSITE,
  this.FIELDS_NAMES.TITLE,
  this.FIELDS_NAMES.BACKGROUND,
  this.FIELDS_NAMES.ADDRESS,
  this.FIELDS_NAMES.DESCRIPTION,
  this.FIELDS_NAMES.MAP,
  this.FIELDS_NAMES.LINK,
  this.FIELDS_NAMES.TAG,
  this.FIELDS_NAMES.PHONE,
  this.FIELDS_NAMES.EMAIL,
  this.FIELDS_NAMES.RATING,
  this.FIELDS_NAMES.PARENT,
  this.FIELDS_NAMES.TAG_CLOUD,
  this.FIELDS_NAMES.PRICE,
  this.FIELDS_NAMES.BUTTON,
  this.FIELDS_NAMES.WORK_TIME,
  this.FIELDS_NAMES.CHART_ID,
  this.FIELDS_NAMES.NEWS_FILTER,
  this.FIELDS_NAMES.PAGE_CONTENT,
  this.FIELDS_NAMES.STATUS,
];

exports.REQUIREDFIELDS_PARENT = [
  this.FIELDS_NAMES.NAME,
  this.FIELDS_NAMES.AVATAR,
  this.FIELDS_NAMES.MAP,
];

exports.REQUIREDFIELDS_SEARCH = [
  this.FIELDS_NAMES.NAME,
  this.FIELDS_NAMES.LIST_ITEM,
  this.FIELDS_NAMES.AVATAR,
  this.FIELDS_NAMES.RATING,
  this.FIELDS_NAMES.PARENT,
];

exports.CAMPAIGN_FIELDS = [
  this.FIELDS_NAMES.NAME,
  this.FIELDS_NAMES.AVATAR,
  this.FIELDS_NAMES.RATING,
  this.FIELDS_NAMES.PARENT,
  this.FIELDS_NAMES.CATEGORY_ITEM,
  this.FIELDS_NAMES.TAG_CATEGORY,
  this.FIELDS_NAMES.PRICE,
  this.FIELDS_NAMES.MAP,
  this.FIELDS_NAMES.ADDRESS,
  this.FIELDS_NAMES.TITLE,
  this.FIELDS_NAMES.DESCRIPTION,
  this.FIELDS_NAMES.SORT_CUSTOM,
];

exports.REQUIREDFIELDS_CHILD = [this.FIELDS_NAMES.NAME, this.FIELDS_NAMES.AVATAR];

exports.REQUIREDFIELDS_POST = [
  this.FIELDS_NAMES.NAME,
  this.FIELDS_NAMES.AVATAR,
  this.FIELDS_NAMES.TITLE,
  this.FIELDS_NAMES.LIST_ITEM,
  this.FIELDS_NAMES.PARENT,
];

exports.categorySwitcher = {
  galleryAlbum: this.FIELDS_NAMES.GALLERY_ITEM,
  galleryItem: this.FIELDS_NAMES.GALLERY_ITEM,
  tagCategory: this.FIELDS_NAMES.CATEGORY_ITEM,
};

exports.SPECIFIC_FIELDS_MAPPINGS = {
  tagCategory: [this.FIELDS_NAMES.TAG_CATEGORY, this.FIELDS_NAMES.CATEGORY_ITEM],
  galleryAlbum: [this.FIELDS_NAMES.GALLERY_ALBUM, this.FIELDS_NAMES.GALLERY_ITEM],
  categoryItem: [this.FIELDS_NAMES.TAG_CATEGORY, this.FIELDS_NAMES.CATEGORY_ITEM],
  avatar: [this.FIELDS_NAMES.AVATAR, this.FIELDS_NAMES.PARENT],
};

exports.MIN_PERCENT_TO_SHOW_UPGATE = 70;

exports.VOTE_STATUSES = {
  APPROVED: 'approved',
  REJECTED: 'rejected',
};
