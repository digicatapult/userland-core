const { runTest, accounts } = require('../runner')
const { buildStepEvents } = require('../util')

runTest({
  name: 'simple-call-to-userland',
  userlands: [
    {
      address: '1000000000000000000000000000000000000000',
      owner: accounts[0].slice(2),
    },
  ],
  blocks: [],
  call: {
    userland: '1000000000000000000000000000000000000000',
    tx: {
      nonce: 0,
      from: accounts[0],
      to: '0x1000000000000000000000000000000000000000',
      gas: '0x100000',
      gasPrice: '0x01',
      value: '0x01',
      data: '0x5800', // [PC, STOP]
    },
  },
  expect: {
    accounts: {
      '1000000000000000000000000000000000000000': {
        lastProcessedBlock: 0,
        contracts: {
          '1000000000000000000000000000000000000000': {
            nonce: '01',
            state: {
              '0000000000000000000000000000000000000000000000000000000000000000': accounts[0].replace(
                '0x',
                ''
              ),
            },
          },
          '7c5a2c91b22d7a9226523d4ba717db6afb741ebd': {
            notExist: true,
          },
        },
      },
    },
    events: [
      { event: 'startProcessBlock', args: { blockNumber: 0 } },
      { event: 'finishProcessBlock', args: { blockNumber: 0 } },
      {
        event: 'runCall',
        args: {
          nonce: '0x',
          from: accounts[0],
          to: '0x1000000000000000000000000000000000000000',
          gasLimit: '0x10000000',
          gasPrice: '0x',
          value: '0x',
          data: '0x5800', // [PC, STOP]
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
          'PC',
          'STOP',
          'POP',
          'STOP',
        ],
      }),
    ],
    call: {
      result: '0x',
    },
  },
})
