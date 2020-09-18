const { faker } = require('test/testHelper');

const hiveRequestMock = ({ name, timestamp } = {}) => ({
  accounts: {
    [name]: {
      transfer_history: [
        [
          faker.random.number(),
          {
            block: faker.random.number(),
            op: [
              'transfer',
              {
                amount: '1.000 HIVE',
                from: faker.name.firstName(),
                memo: '{"id":"user_to_guest_transfer","to":"waivio_oleg-cigulyov"}',
                to: faker.name.firstName(),
              },
            ],
            op_in_trx: 0,
            timestamp: timestamp || '2020-03-03T08:11:09',
            trx_id: '895b94cc49bdb85fe225410133958a06b5176cda',
            trx_in_block: 15,
            virtual_op: 0,
          },
        ],
      ],
    },
  },
  feed_price: {
    base: '59354971.605 HBD',
    quote: '347463319.589 HIVE',
  },
  props: {
    available_account_subsidies: 26059371,
    confidential_sbd_supply: '0.000 HBD',
    confidential_supply: '0.000 HIVE',
    content_reward_percent: 6500,
    current_aslot: 42533666,
    current_sbd_supply: '6595000.045 HBD',
    current_supply: '347463490.656 HIVE',
    current_witness: 'thecryptodrive',
    delegation_return_period: 432000,
  },
});

module.exports = { hiveRequestMock };
