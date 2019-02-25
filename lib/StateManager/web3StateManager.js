/**
 * This module exports a factory function for generating a StateManager
 * implementation that makes read-only calls to a web3 provider.
 * This instance is intended to be wrapped by a `writableStateManager`
 */

const { promisify } = require('util')
const Web3 = require('web3')

const VM = require('ethereumjs-vm')

const { ethereumAccountIsEmpty, mkReadableStateManager } = require('./util')
const { InvalidBlockNumberError } = require('./errors')

const {
  deps: {
    Account: EthereumAccount,
    ethUtil: { bufferToHex, toBuffer, keccak, KECCAK256_NULL },
  },
} = VM

const mkWeb3 = web3Provider => {
  const web3 = new Web3(web3Provider)
  return {
    getCode: promisify((...args) => web3.eth.getCode(...args)),
    getBalance: promisify((...args) => web3.eth.getBalance(...args)),
    getTransactionCount: promisify((...args) =>
      web3.eth.getTransactionCount(...args)
    ),
    getBlockNumber: promisify((...args) => web3.eth.getBlockNumber(...args)),
    getStorageAt: promisify((...args) => web3.eth.getStorageAt(...args)),
  }
}

const assertBlockNumberValid = async ({ web3, blockNumber }) => {
  const currentBlockNumber = await web3.getBlockNumber()
  if (currentBlockNumber < blockNumber) {
    throw new InvalidBlockNumberError(
      `Block number ${blockNumber} is larger than provider block head ${currentBlockNumber}`
    )
  }
}

const web3ResponseToBuffer = num => {
  if (typeof num === 'number') {
    if (num === 0) return Buffer.alloc(0)
    else return toBuffer(num)
  } else if (typeof num === 'string') {
    return toBuffer(num)
  } else {
    return toBuffer(`0x${num.toString(16)}`)
  }
}

module.exports = async ({ web3Provider, blockNumber }) => {
  const web3 = mkWeb3(web3Provider)
  await assertBlockNumberValid({ web3, blockNumber })

  const getContractCode = async addressBuffer => {
    const web3Code = await web3.getCode(bufferToHex(addressBuffer), blockNumber) // string
    if (web3Code === '0x') return null
    else return web3ResponseToBuffer(web3Code)
  }

  const getAccountBalance = async address => {
    return web3ResponseToBuffer(
      await web3.getBalance(address, blockNumber) // BN
    )
  }

  const getTransactionCount = async address => {
    return web3ResponseToBuffer(
      await web3.getTransactionCount(address, blockNumber) // Number
    )
  }

  const getAccount = async addressBuffer => {
    const address = bufferToHex(addressBuffer)
    const [code, balance, nonce] = await Promise.all([
      getContractCode(addressBuffer),
      getAccountBalance(address),
      getTransactionCount(address),
    ])

    const codeHash = code !== null ? keccak(code) : KECCAK256_NULL

    return new EthereumAccount({
      balance,
      nonce,
      codeHash,
    })
  }

  const getContractStorage = async (addressBuffer, key) => {
    return web3ResponseToBuffer(
      await web3.getStorageAt(bufferToHex(addressBuffer), key, blockNumber)
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
