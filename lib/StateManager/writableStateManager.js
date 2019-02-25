/**
 * This `stateManager` implementation decorates a base `stateManager`
 * which is used as a read-only base. Writes are pushed to a `stateTracker`
 * instance which also maintains the state stack over checkpoints. Note
 * that this `stateManager` will allow writes to any account.
 */

const VM = require('ethereumjs-vm')

const {
  ethereumAccountIsEmpty,
  addCbSupport,
  errorInvalidOperation,
} = require('./util')

const {
  deps: {
    Account: EthereumAccount,
    ethUtil: { keccak },
  },
} = VM

const bufferToHex = b => b.toString('hex')
const stringToBuffer = s => Buffer.from(s, 'hex')

module.exports = async ({ stateManagerBase, stateTracker }) => {
  const checkpointStack = []
  const empty = stateTracker.emptyValue

  const getAccount = async addressBuffer => {
    const address = bufferToHex(addressBuffer)
    const nonce = await stateTracker.getAccountNonce(address)
    const balance = await stateTracker.getAccountBalance(address)
    const code = await stateTracker.getAccountCode(address)

    if (nonce === empty || balance === empty || code === empty) {
      const baseAccount = await stateManagerBase.getAccount(addressBuffer)
      return new EthereumAccount({
        nonce: nonce === empty ? baseAccount.nonce : stringToBuffer(nonce),
        balance:
          balance === empty ? baseAccount.balance : stringToBuffer(balance),
        codeHash:
          code === empty ? baseAccount.codeHash : keccak(stringToBuffer(code)),
      })
    } else {
      return new EthereumAccount({
        nonce: stringToBuffer(nonce),
        balance: stringToBuffer(balance),
        codeHash: keccak(stringToBuffer(code)),
      })
    }
  }

  const putAccount = async (addressBuffer, account) => {
    const address = bufferToHex(addressBuffer)
    await stateTracker.setAccountNonce(address, bufferToHex(account.nonce))
    await stateTracker.setAccountBalance(address, bufferToHex(account.balance))
  }

  const getContractCode = async addressBuffer => {
    const address = bufferToHex(addressBuffer)
    const code = await stateTracker.getAccountCode(address)

    return code === empty
      ? await stateManagerBase.getContractCode(addressBuffer)
      : stringToBuffer(code)
  }

  const putContractCode = async (addressBuffer, codeBuffer) => {
    const address = bufferToHex(addressBuffer)
    const code = bufferToHex(codeBuffer)
    const account = await getAccount(addressBuffer)
    account.codeHash = keccak(codeBuffer)
    await putAccount(addressBuffer, account)
    await stateTracker.setAccountCode(address, code)
  }

  const getContractStorage = async (addressBuffer, keyBuffer) => {
    const address = bufferToHex(addressBuffer)
    const key = bufferToHex(keyBuffer)
    const state = await stateTracker.getAccountState(address, key)

    return state === empty
      ? await stateManagerBase.getContractStorage(addressBuffer, keyBuffer)
      : stringToBuffer(state)
  }

  const putContractStorage = async (addressBuffer, keyBuffer, valueBuffer) => {
    const address = bufferToHex(addressBuffer)
    const key = bufferToHex(keyBuffer)
    const value = bufferToHex(valueBuffer)
    await stateTracker.setAccountState(address, key, value)
  }

  const clearContractStorage = async addressBuffer => {
    const address = bufferToHex(addressBuffer)
    await stateTracker.clearAccountState(address)
  }

  const accountIsEmpty = async addressBuffer => {
    if (ethereumAccountIsEmpty(await getAccount(addressBuffer))) {
      const address = bufferToHex(addressBuffer)
      return !(await stateTracker.accountIsCleared(address))
    } else {
      return false
    }
  }

  const checkpoint = async () => {
    checkpointStack.push(await stateTracker.checkpointState())
  }

  const commit = async () => {
    const head = checkpointStack.pop()
    await stateTracker.commitState(head)
  }

  const revert = async () => {
    const head = checkpointStack.pop()
    await stateTracker.revertState(head)
  }

  return addCbSupport({
    getAccount,
    putAccount,
    putContractCode,
    getContractCode,
    getContractStorage,
    putContractStorage,
    clearContractStorage,
    checkpoint,
    commit,
    revert,
    accountIsEmpty,
    cleanupTouchedAccounts: () => Promise.resolve(),
    getStateRoot: errorInvalidOperation,
  })
}
