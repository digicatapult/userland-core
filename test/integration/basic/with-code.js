const { runTest, accounts } = require('../runner')
const { buildStepEvents } = require('../util')

runTest({
  name: 'with-code',
  userlands: [
    {
      address: '1000000000000000000000000000000000000000',
      owner: accounts[0].slice(2),
    },
  ],
  blocks: [
    {
      transactions: [
        {
          nonce: 0,
          from: accounts[0],
          to: '0x1000000000000000000000000000000000000000',
          gas: '0x100000',
          gasPrice: '0x01',
          value: '0x01',
          data: '0x62c0ffee6000526003601df3', // [PUSH3 C0FFEE, PUSH1 00, MSTORE, PUSH1 03, PUSH1 00, RETURN ]
        },
      ],
    },
  ],
  expect: {
    accounts: {
      '1000000000000000000000000000000000000000': {
        lastProcessedBlock: 1,
        contracts: {
          '1000000000000000000000000000000000000000': {
            nonce: '02',
            state: {
              '0000000000000000000000000000000000000000000000000000000000000000':
                '',
            },
          },
          '7c5a2c91b22d7a9226523d4ba717db6afb741ebd': {
            nonce: '01',
            code: 'c0ffee',
          },
        },
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
          to: '0x1000000000000000000000000000000000000000',
          gasLimit: '0x100000',
          gasPrice: '0x01',
          value: '0x01',
          data: '0x62c0ffee6000526003601df3', // [PUSH3 C0FFEE, PUSH1 00, MSTORE, PUSH1 03, PUSH1 00, RETURN ]
        },
      },
      {
        event: 'userlandCall',
      },
      ...buildStepEvents({
        userland: '1000000000000000000000000000000000000000',
        opcodes: [
          'PC',
          'DUP1',
          'SLOAD',
          'CALLER',
          'EQ',
          'PUSH1',
          'JUMPI',
          'JUMPDEST',
          'DUP1',
          'SSTORE',
          'CALLDATASIZE',
          'PUSH1',
          'DUP2',
          'DUP2',
          'DUP3',
          'CALLDATACOPY',
          'DUP1',
          'CREATE',
          'PUSH3',
          'PUSH1',
          'MSTORE',
          'PUSH1',
          'PUSH1',
          'RETURN',
          'POP',
          'STOP',
        ],
      }),
      { event: 'finishProcessBlock', args: { blockNumber: 1 } },
    ],
  },
})
