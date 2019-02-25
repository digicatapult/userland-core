const { runTest } = require('../runner')

runTest({
  name: 'empty-block',
  userlands: [
    {
      address: '1000000000000000000000000000000000000000',
      owner: '1000000000000000000000000000000000000000',
    },
  ],
  blocks: [
    {
      transactions: [],
    },
  ],
  expect: {
    accounts: {
      '1000000000000000000000000000000000000000': {
        lastProcessedBlock: 1,
      },
    },
    events: [
      { event: 'startProcessBlock', args: { blockNumber: 0 } },
      { event: 'finishProcessBlock', args: { blockNumber: 0 } },
      { event: 'startProcessBlock', args: { blockNumber: 1 } },
      { event: 'finishProcessBlock', args: { blockNumber: 1 } },
    ],
  },
})
