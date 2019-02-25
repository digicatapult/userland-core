const VM = require('ethereumjs-vm')

const { InvalidOperationError } = require('./errors')

const {
  deps: { ethUtil },
} = VM

const ethereumAccountIsEmpty = account => {
  return (
    account.nonce.toString('hex') === '' &&
    account.balance.toString('hex') === '' &&
    account.codeHash.toString('hex') === ethUtil.KECCAK256_NULL_S
  )
}

const stateManagerMethods = [
  'getAccount',
  'putAccount',
  'getContractCode',
  'putContractCode',
  'getContractStorage',
  'putContractStorage',
  'clearContractStorage',
  'accountIsEmpty',
  'checkpoint',
  'commit',
  'revert',
  'getStateRoot',
  'cleanupTouchedAccounts',
]
const addCbSupport = stateManager => {
  return stateManagerMethods.reduce((acc, fn) => {
    return {
      [fn]: (...args) => {
        const callback = args[args.length - 1]
        if (typeof callback === 'function') {
          const rest = args.slice(0, args.length - 1)

          stateManager[fn](...rest).then(
            res => {
              callback(null, res)
            },
            err => {
              callback(err)
            }
          )
        } else {
          return stateManager[fn](...args)
        }
      },
      ...acc,
    }
  }, {})
}

const errorInvalidOperation = () => {
  throw new InvalidOperationError(
    'Write operations are not allowed against external state'
  )
}

const mkReadableStateManager = stateManager =>
  addCbSupport({
    getAccount: stateManager.getAccount,
    putAccount: errorInvalidOperation,
    putContractCode: errorInvalidOperation,
    getContractCode: stateManager.getContractCode,
    getContractStorage: stateManager.getContractStorage,
    putContractStorage: errorInvalidOperation,
    clearContractStorage: errorInvalidOperation,
    checkpoint: errorInvalidOperation,
    commit: errorInvalidOperation,
    revert: errorInvalidOperation,
    getStateRoot: errorInvalidOperation,
    accountIsEmpty: stateManager.accountIsEmpty,
    cleanupTouchedAccounts: errorInvalidOperation,
  })

module.exports = {
  ethereumAccountIsEmpty,
  addCbSupport,
  errorInvalidOperation,
  mkReadableStateManager,
}
