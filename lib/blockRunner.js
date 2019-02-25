const Web3 = require('web3')
const VM = require('ethereumjs-vm')
const EthereumTx = require('ethereumjs-tx/fake')
const util = require('util')
const EventEmitter = require('events')

const { mkStateTracker } = require('./StateTracker')

const {
  deps: { ethUtil },
} = VM

// taken from ethereumjs-vm/lib/opFns.js
const loadMemory = (memory, offset, length) => {
  if (length.isZero()) {
    return Buffer.alloc(0)
  }

  offset = offset.toNumber()
  length = length.toNumber()

  const loaded = memory.slice(offset, offset + length)
  // fill the remaining length with zeros
  for (let i = loaded.length; i < length; i++) {
    loaded[i] = 0
  }
  return Buffer.from(loaded)
}

const runCallForUserlands = async ({
  context,
  logger,
  stateTracker,
  transaction,
  toAddress,
  fromAddress,
  data,
}) => {
  // pause writes synchronously with respect to the vm step
  // Also locks the userland associated with this proxy so it cannot run two calls at once
  // this must be the first async call in this function
  const childStateTrackers = await stateTracker.startCall()
  await Promise.all(
    childStateTrackers.map(async stateTracker => {
      const callOpts = {
        caller: ethUtil.toBuffer(fromAddress),
        data,
        gasLimit: ethUtil.toBuffer(stateTracker.transactionGasLimit), // fixed call gas limit
        gasPrice: Buffer.alloc(0), // always zero out gasPrice
        origin: transaction.from,
        to: toAddress,
        value: Buffer.alloc(0), // always zero out value
        userland: stateTracker.userland,
      }

      context.emit('userlandCall', {
        stateTracker,
        transaction,
        callOpts,
      })

      const vm = await runCommon({ context, logger, stateTracker, transaction })
      await vm.runCall(callOpts)
    })
  )
  stateTracker.endCall()
}

const callOpcodes = new Map([
  ['CALL', { foreignCode: false }],
  ['CALLCODE', { foreignCode: true }],
  // This is awkward and broken as we need to maintain caller information and this is not available
  ['DELEGATECALL', { foreignCode: true }],
  // No need to run static calls as they cannot affect state in userland
  // ['STATICCALL', { foreignCode: false }],
])

const runCommon = async ({ context, logger, stateTracker, transaction }) => {
  const vm = new VM({ stateManager: stateTracker.stateManager })
  const innerCallPromises = []

  // watch the vm for `call` type opcodes
  vm.on('step', ({ opcode, stack, memory, address, caller, ...evProps }) => {
    logger.trace(`STEP ${opcode.name}`)
    context.emit('step', {
      userland: stateTracker.userland,
      opcode,
      stack,
      memory,
      address,
      caller,
      ...evProps,
    })

    if (callOpcodes.has(opcode.name)) {
      const args = [...stack].splice(-opcode.in).reverse()
      const [, codeAddress] = args // first argument is always `value`, second is the address to get code from
      // this is the address whose storage context will be used for the call
      const toAddress = callOpcodes.get(opcode.name).foreignCode
        ? address
        : codeAddress

      // TODO: need vm changes to handle delegatecall properly. Explicitly we need access to caller of parent

      // asynchronously kick off the next call. This will pause writes
      // in the mainnet synchronously first so can be safely called
      // without `await`. We need to save the promise though so we can sync the call
      // at the end
      const callP = runCallForUserlands({
        context,
        logger,
        stateTracker,
        transaction,
        toAddress,
        fromAddress: address,
        caller,
        data: loadMemory(
          memory,
          args[opcode.in - 4], // args either has 6 or 7 members
          args[opcode.in - 3] // depending on the type of call
        ),
      })
      innerCallPromises.push(callP)
    }
  })

  const vmCall = util.promisify((opts, cb) => vm.runCall(opts, cb))
  const vmTx = util.promisify((opts, cb) => vm.runTx(opts, cb))

  return {
    runCall: async opts => {
      const result = await vmCall(opts)
      while (innerCallPromises.length !== 0) {
        await innerCallPromises.pop()
      }
      return result
    },
    runTx: async opts => {
      const result = await vmTx(opts)
      while (innerCallPromises.length !== 0) {
        await innerCallPromises.pop()
      }
      return result
    },
  }
}

const runTransaction = async ({
  context,
  logger,
  stateTracker,
  transaction,
}) => {
  context.emit('runTransaction', {
    nonce: `0x${transaction.nonce.toString('hex')}`,
    gasLimit: `0x${transaction.gas.toString('hex')}`,
    gasPrice: `0x${transaction.gasPrice.toString('hex')}`,
    to: `0x${transaction.to.toString('hex')}`,
    from: `0x${transaction.from.toString('hex')}`,
    value: `0x${transaction.value.toString('hex')}`,
    data: `0x${transaction.input.toString('hex')}`,
  })

  // set off the call in userlands first. This will pause writes
  // in the mainnet synchronously first so can be safely called
  // without `await`. Save out the promise so we can sync at the end
  const toAddress = transaction.to
  const userlandCallP =
    toAddress.length !== 0
      ? runCallForUserlands({
          context,
          logger,
          stateTracker,
          transaction,
          toAddress,
          fromAddress: transaction.from,
          data: transaction.data,
        })
      : Promise.resolve()

  const vm = await runCommon({
    context,
    logger,
    stateTracker,
    transaction,
  })
  const txResults = await vm.runTx({ tx: transaction })
  await userlandCallP
  return txResults
}

const addressStringToBuffer = s => {
  if (s === null || s === undefined) return undefined
  else if (typeof s === 'string') {
    if (s.indexOf('0x' === 0)) {
      s = s.substring(2)
    }
    if (s === '0' || s === '') return undefined
    else {
      while (s.length < 40) s = '0' + s
      return Buffer.from(s, 'hex')
    }
  }
}

module.exports = ({ storageManager, web3Provider, logger }) => {
  const web3 = new Web3(web3Provider)
  const getBlock = util.promisify((...args) => web3.eth.getBlock(...args))
  const getBlockNumber = util.promisify((...args) =>
    web3.eth.getBlockNumber(...args)
  )
  const getTransaction = util.promisify((...args) =>
    web3.eth.getTransaction(...args)
  )

  const context = new EventEmitter()
  Object.assign(context, {
    // TODO: work out where to validate that we have processed all previously necessary blocks
    runBlock: async blockNumber => {
      const block = await getBlock(blockNumber)
      const transactions = await Promise.all(
        block.transactions.map(async txHash => {
          const web3Transaction = await getTransaction(txHash)
          const tx = new EthereumTx({
            nonce: ethUtil.toBuffer(web3Transaction.nonce),
            gasLimit: ethUtil.toBuffer(web3Transaction.gas),
            gasPrice: `0x${web3Transaction.gasPrice.toString(16)}`,
            to: addressStringToBuffer(web3Transaction.to),
            from: addressStringToBuffer(web3Transaction.from),
            value: `0x${web3Transaction.value.toString(16)}`,
            data: ethUtil.toBuffer(web3Transaction.input),
          })
          return tx
        })
      )

      const stateTracker = await mkStateTracker({
        baseUserland: null,
        storageManager,
        web3Provider,
        logger,
        baseBlockNumber: blockNumber - 1,
      })
      const blockCheckpoint = await stateTracker.checkpointState()

      try {
        const receipts = await transactions.reduce(async (acc, transaction) => {
          return [
            ...(await acc),
            await runTransaction({
              context,
              logger,
              stateTracker,
              transaction,
            }),
          ]
        }, Promise.resolve([]))
        await stateTracker.persistState(blockCheckpoint)
        return receipts
      } catch (err) {
        logger.error('Unexpected error processing block: ', err)
        await stateTracker.revertState(blockCheckpoint)
        throw err
      }
    },
    // runCall is used for simulating a transaction
    runCall: async (userland, transaction) => {
      const stateTracker = await mkStateTracker({
        storageManager,
        web3Provider,
        logger,
        baseUserland: userland,
        baseBlockNumber: await getBlockNumber(),
      })
      const blockCheckpoint = await stateTracker.checkpointState()

      const vm = await runCommon({
        context,
        logger,
        stateTracker,
        transaction,
      })
      const callOpts = {
        caller: ethUtil.toBuffer(transaction.from),
        data: transaction.data,
        gasLimit: ethUtil.toBuffer(stateTracker.transactionGasLimit), // fixed call gas limit
        gasPrice: Buffer.alloc(0), // always zero out gasPrice
        origin: transaction.from,
        to: transaction.to,
        value: Buffer.alloc(0), // always zero out value
        userland: stateTracker.userland,
      }

      context.emit('runCall', {
        nonce: `0x${transaction.nonce.toString('hex')}`,
        gasLimit: `0x${stateTracker.transactionGasLimit}`, // fixed call gas limit
        gasPrice: '0x', // always zero out gasPrice
        to: `0x${transaction.to.toString('hex')}`,
        from: `0x${transaction.from.toString('hex')}`,
        value: '0x', // always zero out value
        data: `0x${transaction.data.toString('hex')}`,
      })

      if (userland !== null) {
        context.emit('userlandCall', {
          stateTracker,
          transaction,
          callOpts,
        })
      }

      const txResults = await vm.runCall(callOpts)

      // always revert as call is not state-changing
      await stateTracker.revertState(blockCheckpoint)

      return {
        createdAddress: txResults.createdAddress,
        result: txResults.vm.return,
        gasUsed: txResults.vm.gasUsed,
      }
    },
  })

  return context
}
