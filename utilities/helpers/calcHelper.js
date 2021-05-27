const BigNumber = require('bignumber.js');
const _ = require('lodash');

exports.sumBy = (arr, field) => _.reduce(arr, (value, element) => {
  value = new BigNumber(value).plus(element[field]);
  return value;
}, new BigNumber(0)).toNumber();

exports.add = (...args) => _.reduce(args, (value, element) => {
  value = new BigNumber(value).plus(element);
  return value;
}, new BigNumber(0)).toNumber();
