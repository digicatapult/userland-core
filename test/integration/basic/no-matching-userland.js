const { runTest, accounts } = require('../runner')
const { buildStepEvents } = require('../util')

runTest({
  name: 'no-matching-userland',
  userlands: [
    {
      address: '1000000000000000000000000000000000000000',
      owner: '1000000000000000000000000000000000000000',
    },
  ],
  blocks: [
    {
      transactions: [
        {
          nonce: 0,
          from: accounts[0],
          gas: '0x100000',
          gasPrice: '0x01',
          value: '0x01',
          data: '0x5800', // [PC, STOP]
        },
      ],
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
      {
        event: 'runTransaction',
        args: {
          nonce: '0x',
          from: accounts[0],
          to: '0x',
          gasLimit: '0x100000',
          gasPrice: '0x01',
          value: '0x01',
          data: '0x5800', // [PC, STOP]
        },
      },
      ...buildStepEvents({ userland: null, opcodes: ['PC', 'STOP'] }),
      { event: 'finishProcessBlock', args: { blockNumber: 1 } },
    ],
  },
})
