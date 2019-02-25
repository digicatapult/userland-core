const solc = require('solc')

const makeInput = source =>
  JSON.stringify({
    language: 'Solidity',
    settings: {
      outputSelection: {
        '*': {
          '*': ['evm.bytecode'],
        },
      },
    },
    sources: {
      'source.sol': {
        content: source,
      },
    },
  })

const compileSingleContract = source => {
  const output = JSON.parse(solc.compile(makeInput(source)))
  const contractValues = Object.values(output.contracts['source.sol'])
  return contractValues[0].evm.bytecode.object
}

const buildStepEvents = ({ userland, opcodes }) =>
  opcodes.map(name => {
    return { event: 'step', args: { userland, opcode: { name } } }
  })

module.exports = {
  compileSingleContract,
  buildStepEvents,
}
