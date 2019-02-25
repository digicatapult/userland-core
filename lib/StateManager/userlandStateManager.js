/**
 * This `stateManager` decorator takes a `writableStateManager` for a userland
 * and a `baseStateManager` for the parent environment of that userland. Writes
 * are directed to the userland only if the account is present in that userland.
 * Reads are delegated depending on whether the account is in the userland or not
 */

const VM = require('ethereumjs-vm')

const { ethereumAccountIsEmpty, addCbSupport } = require('./util')
const { InvalidWriteError } = require('./errors')

const {
  deps: {
    ethUtil: { keccak },
  },
} = VM

module.exports = async ({ stateManager, baseStateManager }) => {
  const buildReadFunc = fn => async (addressBuffer, ...args) => {
    if (await stateManager.accountIsEmpty(addressBuffer)) {
      return await baseStateManager[fn](addressBuffer, ...args)
    } else {
      return await stateManager[fn](addressBuffer, ...args)
    }
  }

  const buildWriteFunc = (fn, checkEql) => async (addressBuffer, ...args) => {
    if (await stateManager.accountIsEmpty(addressBuffer)) {
      if (!(await checkEql(addressBuffer, ...args)))
        throw new InvalidWriteError()
    } else {
      await fn(addressBuffer, ...args)
    }
  }

  const getAccount = buildReadFunc('getAccount')
  const putAccount = buildWriteFunc(
    stateManager.putAccount,
    async (addressBuffer, account) => {
      const writeVal = account.serialize()
      const getVal = (await getAccount(addressBuffer)).serialize()
      return getVal.equals(writeVal)
    }
  )

  const getContractCode = buildReadFunc('getContractCode')
  const putContractCode = buildWriteFunc(
    stateManager.putContractCode,
    async (addressBuffer, code) => {
      const account = await baseStateManager.getAccount(addressBuffer)
      return keccak(code) === account.codeHash
    }
  )

  const getContractStorage = buildReadFunc('getContractStorage')
  const putContractStorage = buildWriteFunc(
    stateManager.putContractStorage,
    async (addressBuffer, keyBuffer, valueBuffer) => {
      const state = await baseStateManager.getContractStorage(
        addressBuffer,
        keyBuffer
      )
      return state.equals(valueBuffer)
    }
  )

  const clearContractStorage = async addressBuffer => {
    // this is a entirely janky. Basically storage is only cleared on
    // creating a new account. We can therefore infer that this is
    // always fine. TODO: write integration tests specifically for THIS
    await stateManager.clearContractStorage(addressBuffer)
  }

  const accountIsEmpty = async addressBuffer =>
    ethereumAccountIsEmpty(await getAccount(addressBuffer))

  const checkpoint = async () => {
    await stateManager.checkpoint()
  }

  const commit = async () => {
    await stateManager.commit()
  }

  const revert = async () => {
    await stateManager.revert()
  }

  return addCbSupport({
    getAccount,
    putAccount,
    getContractCode,
    putContractCode,
    getContractStorage,
    putContractStorage,
    clearContractStorage,
    checkpoint,
    commit,
    revert,
    accountIsEmpty,
    cleanupTouchedAccounts: () => {},
  })
}
