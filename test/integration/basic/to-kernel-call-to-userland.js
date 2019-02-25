const { runTest, accounts } = require('../runner')
const { buildStepEvents } = require('../util')

runTest({
  name: 'to-kernel-call-to-userland',
  userlands: [
    {
      address: '1000000000000000000000000000000000000000',
      owner: '9a00aabc3f5a99f9a62a92ed7635d7c8f7750f8b',
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
          // gasLimit, toAddress, value, inOffset, inLength, outOffset, outLength
          // [PUSH2 [PC, STOP], PUSH1 0, MSTORE, PUSH1 0, DUP1, PUSH1 2, PUSH1 1e, DUP3, PUSH20 1000000000000000000000000000000000000000, DUP2, CALL, STOP]
          data:
            '0x6158006000526000806002601e8273100000000000000000000000000000000000000081f100',
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
          to: '0x',
          gasLimit: '0x100000',
          gasPrice: '0x01',
          value: '0x01',
          data:
            '0x6158006000526000806002601e8273100000000000000000000000000000000000000081f100',
        },
      },
      ...buildStepEvents({
        userland: null,
        opcodes: [
          'PUSH2',
          'PUSH1',
          'MSTORE',
          'PUSH1',
          'DUP1',
          'PUSH1',
          'PUSH1',
          'DUP3',
          'PUSH20',
          'DUP2',
          'CALL',
        ],
      }),
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
      ...buildStepEvents({
        userland: null,
        opcodes: ['STOP'],
      }),
      { event: 'finishProcessBlock', args: { blockNumber: 1 } },
    ],
  },
})
