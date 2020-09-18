const moment = require('moment');
const paymentHistoriesHelper = require('utilities/helpers/paymentHistoriesHelper');

module.exports = async ({
  skip, limit, days, payable, sponsor, userName, sort, type,
  globalReport, objects, endDate, startDate, currency, processingFees,
}) => {
  if (!sponsor && !userName) return { error: { status: 422, message: 'One of userName or sponsor is required!' } };
  const filterDate = days ? moment().subtract(days, 'days').toDate() : null;
  const filterPayable = payable;

  if (globalReport) {
    if (!sponsor) return { error: { status: 422, message: 'Sponsor is required!' } };
    return paymentHistoriesHelper.withoutWrapperPayables({
      matchData: {
        sponsor, userName, objects, endDate, startDate, processingFees,
      },
      skip,
      limit,
      currency,
      processingFees,
      filterPayable,
      pipeline: paymentHistoriesHelper.createReportPipeline,
    });
  }
  if ((sponsor && userName) || (userName && type)) {
    return paymentHistoriesHelper.withoutWrapperPayables({
      matchData: { sponsor, userName, type }, skip, limit, pipeline: paymentHistoriesHelper.withoutWrapPipeline,
    });
  }
  if (sponsor && !userName) {
    return paymentHistoriesHelper.withWrapperPayables({
      sponsor, filterDate, filterPayable, skip, limit, sort, payment_type: 'payables',
    });
  }
  if (!sponsor && userName) {
    return paymentHistoriesHelper.withWrapperPayables({
      userName, filterDate, filterPayable, skip, limit, sort, payment_type: 'receivables',
    });
  }
};
