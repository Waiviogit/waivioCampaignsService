const axios = require('axios');
const axiosRetry = require('axios-retry');
const _ = require('lodash');
const jsonHelper = require('../../helpers/jsonHelper');
const CampaignModel = require('../../../models/campaignModel');

const getData = async (guideName, startDate) => {
  const data = {
    jsonrpc: '2.0',
    method: 'database_api.list_comments',
    params: {
      start: [guideName, startDate, '', ''],
      order: 'by_last_update',
    },
    id: 1,
  };
  try {
    const instance = axios.create();
    axiosRetry(instance, {
      retries: 3,
      retryDelay: (retryCount) => retryCount * 100,
      retryCondition: (error) => error.response.status !== 200,
    });
    return await instance.post('https://api.hive.blog', data);
  } catch (error) {
    return error;
  }
};

const setDate = async (comments) => {
  for (const element of comments) {
    const json = jsonHelper.parseJson(element.json_metadata);
    if (_.get(json, 'waivioRewards.type') === 'waivio_stop_campaign' && _.get(json, 'waivioRewards.timestamp')) {
      await CampaignModel.updateOne({
        deactivation_permlink: element.permlink,
      },
      { $set: { stoppedAt: json.waivioRewards.timestamp } });
      console.log('set:', element.permlink);
    }
  }
};

const setDeactivationDate = async () => {
  const { sponsors, error } = await CampaignModel.findSponsors({ deactivation_permlink: { $exists: true } });
  if (!sponsors || error) return { error };
  for (const sponsor of sponsors) {
    let startDate = '2022-01-01T19:34:09';
    let result = [];
    do {
      const res = await getData(sponsor, startDate);
      if (res instanceof Error) return { error: res };

      result = _.get(res, 'data.result.comments');
      if (_.isEmpty(result)) break;

      startDate = result[result.length - 1].last_update;
      await setDate(result);
    } while (result.length > 999);
  }
};
module.exports = {
  setDeactivationDate,
};
