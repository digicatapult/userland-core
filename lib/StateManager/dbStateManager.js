/**
 * This module exports a factory function for generating a StateManager
 * implementation that makes read-only calls to a storageManager instance.
 * This instance is intended to be wrapped by a `writableStateManager`
 */

const VM = require('ethereumjs-vm')

const { ethereumAccountIsEmpty, mkReadableStateManager } = require('./util')

const {
  deps: {
    Account: EthereumAccount,
    ethUtil: { keccak, bufferToHex, toBuffer },
  },
} = VM

const bufferToStrippedHex = b => {
  const hex = bufferToHex(b)
  if (hex) return hex.slice(2)
}

const strippedHexToBuffer = s => {
  if (s === null || s.length === 0) return Buffer.alloc(0)
  else return toBuffer(`0x${s}`)
}

module.exports = async ({ storageManager, userland, blockNumber }) => {
  const getContractCode = async addressBuffer => {
    return strippedHexToBuffer(
      await storageManager.getAccountCode(
        blockNumber,
        userland,
        bufferToStrippedHex(addressBuffer)
      )
    )
  }

  const getAccount = async addressBuffer => {
    const address = bufferToStrippedHex(addressBuffer)
    const [code, balance, nonce] = await Promise.all([
      getContractCode(addressBuffer),
      storageManager.getAccountBalance(blockNumber, userland, address),
      storageManager.getAccountNonce(blockNumber, userland, address),
    ])

    return new EthereumAccount({
      balance: strippedHexToBuffer(balance),
      nonce: strippedHexToBuffer(nonce),
      codeHash: keccak(code),
    })
  }

  const getContractStorage = async (addressBuffer, keyBuffer) => {
    return strippedHexToBuffer(
      await storageManager.getAccountState(
        blockNumber,
        userland,
        bufferToStrippedHex(addressBuffer),
        bufferToStrippedHex(keyBuffer)
      )
    )
  }

  const accountIsEmpty = async addressBuffer =>
    ethereumAccountIsEmpty(await getAccount(addressBuffer))

  return mkReadableStateManager({
    getAccount,
    getContractCode,
    getContractStorage,
    accountIsEmpty,
  })
}
