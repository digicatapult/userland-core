const mkStateMap = require('./localStateMap')
const {
  mkWeb3StateManager,
  mkWritableStateManager,
  mkUserlandStateManager,
  mkDbStateManager,
} = require('../StateManager')
const errors = require('./errors')

const { InvalidCheckpointError } = errors

const mkLock = () => {
  let lockPromise = null
  let lockResolve = null
  return {
    enter: async () => {
      while (lockPromise !== null) {
        await lockPromise
      }

      lockPromise = new Promise(resolve => {
        lockResolve = resolve
      })
    },
    exit: () => {
      lockPromise = null
      lockResolve()
    },
  }
}

module.exports = async ({
  web3Provider,
  logger,
  storageManager,
  baseUserland,
  baseBlockNumber,
}) => {
  const stateTrackers = new Map()
  const mkTracker = async ({ userland, parentStateManager }) => {
    const isKernel = userland === null
    const isBase = userland === baseUserland

    // The process by which we enter or leave a call
    // for a given userland must be controlled.
    const writeLock = mkLock()

    // The stateStack tracks all state changes in this userland
    // and its children. The state at each checkpoint level is
    // stored in a Map like structure. Child states are tracked
    // by storing checkpoint symbols for each direct child that
    // is called into
    const stateStack = []
    const currentBlockNumber = baseBlockNumber + 1

    let transactionGasLimit = null
    if (!isKernel) {
      const u = await storageManager.getUserland(userland)
      transactionGasLimit = u.transactionGasLimit
    }

    const emptyValue = Symbol(`Empty value for userland ${userland}`)
    const getFn = stackKey => (...args) => {
      for (let i = stateStack.length - 1; i >= 0; i--) {
        if (stateStack[i][stackKey].has(...args))
          return stateStack[i][stackKey].get(...args)
      }
      return emptyValue
    }

    let stateManager = null
    let childStateTrackers = null

    const stateTracker = {
      get userland() {
        return userland
      },
      get transactionGasLimit() {
        return transactionGasLimit
      },
      get stateManager() {
        return stateManager
      },
      get emptyValue() {
        return emptyValue
      },
      startCall: async () => {
        // lock writes to this userland first. This lock is synchronously engaged
        // and the queue is maintained by the promise resolution mechanism.
        await writeLock.enter()
        return childStateTrackers
      },
      endCall: () => {
        writeLock.exit()
      },
      setAccountState: async (addr, key, value) => {
        await writeLock.enter()
        stateStack[stateStack.length - 1].state.set(addr, key, value)
        writeLock.exit()
      },
      clearAccountState: async addr => {
        await writeLock.enter()
        const stackHead = stateStack[stateStack.length - 1]
        stackHead.clearedAccounts.add(addr)
        stackHead.state.clear(addr)
        writeLock.exit()
      },
      accountIsCleared: async addr => {
        for (let i = stateStack.length - 1; i >= 0; i--) {
          if (stateStack[i].clearedAccounts.has(addr)) {
            return true
          }
        }
        return false
      },
      getAccountState: async (addr, key) => {
        for (let i = stateStack.length - 1; i >= 0; i--) {
          if (stateStack[i].state.has(addr, key)) {
            return stateStack[i].state.get(addr, key)
          }

          if (stateStack[i].clearedAccounts.has(addr)) {
            return ''
          }
        }
        return emptyValue
      },
      setAccountBalance: async (addr, value) => {
        await writeLock.enter()
        stateStack[stateStack.length - 1].balances.set(addr, value)
        writeLock.exit()
      },
      getAccountBalance: getFn('balances'),
      setAccountCode: async (addr, value) => {
        await writeLock.enter()
        stateStack[stateStack.length - 1].codes.set(addr, value)
        writeLock.exit()
      },
      getAccountCode: getFn('codes'),
      setAccountNonce: async (addr, value) => {
        await writeLock.enter()
        stateStack[stateStack.length - 1].nonces.set(addr, value)
        writeLock.exit()
      },
      getAccountNonce: getFn('nonces'),
      checkpointState: async () => {
        const symbol = Symbol(
          `Userland ${userland}, Stack Size ${stateStack.length}`
        )
        const childCheckpoints = new Map()
        await Promise.all(
          childStateTrackers.map(async u => {
            if (!childCheckpoints.has(u))
              childCheckpoints.set(u, await u.checkpointState())
          })
        )

        stateStack.push({
          symbol,
          state: mkStateMap(),
          balances: new Map(),
          codes: new Map(),
          nonces: new Map(),
          clearedAccounts: new Set(),
          childCheckpoints,
        })
        return symbol
      },
      commitState: checkpoint => {
        // Validate checkpoint symbol and make sure we're not squashing the bottom level
        if (
          stateStack[stateStack.length - 1].symbol === checkpoint &&
          stateStack.length > 1
        ) {
          // Squish top-level map into below map
          const {
            state,
            balances,
            codes,
            nonces,
            clearedAccounts,
            childCheckpoints,
          } = stateStack.pop()

          for (const addr of clearedAccounts) {
            stateStack[stateStack.length - 1].state.clear(addr)
            stateStack[stateStack.length - 1].clearedAccounts.add(addr)
          }

          for (const [addr, key, value] of state) {
            stateStack[stateStack.length - 1].state.set(addr, key, value)
          }

          for (const [addr, value] of balances) {
            stateStack[stateStack.length - 1].balances.set(addr, value)
          }

          for (const [addr, value] of nonces) {
            stateStack[stateStack.length - 1].nonces.set(addr, value)
          }

          for (const [addr, value] of codes) {
            stateStack[stateStack.length - 1].codes.set(addr, value)
          }

          for (const [userland, symbol] of childCheckpoints) {
            userland.commitState(symbol)
          }
        } else throw new InvalidCheckpointError()
      },
      revertState: async checkpoint => {
        if (stateStack[stateStack.length - 1].symbol === checkpoint) {
          await writeLock.enter()
          const { childCheckpoints } = stateStack[stateStack.length - 1]
          for (const [childTracker, symbol] of childCheckpoints) {
            await childTracker.revertState(symbol)
          }
          stateStack.pop()
          writeLock.exit()
        } else throw new InvalidCheckpointError()
      },
      persistState: async (checkpoint, trx) => {
        if (
          stateStack[stateStack.length - 1].symbol === checkpoint &&
          stateStack.length === 1
        ) {
          try {
            const {
              state,
              balances,
              codes,
              nonces,
              clearedAccounts,
              childCheckpoints,
            } = stateStack.pop()

            // start the transaction if this is the base
            if (isBase) {
              trx = await storageManager.startTransaction(currentBlockNumber)
            }

            // we don't need to commit changes to the kernel
            if (!isKernel) {
              for (const addr of clearedAccounts) {
                await storageManager.clearAccountState(trx, userland, addr)
              }

              for (const [addr, key, value] of state) {
                await storageManager.setAccountState(
                  trx,
                  userland,
                  addr,
                  key,
                  value
                )
              }

              for (const [addr, value] of balances) {
                await storageManager.setAccountBalance(
                  trx,
                  userland,
                  addr,
                  value
                )
              }

              for (const [addr, value] of nonces) {
                await storageManager.setAccountNonce(trx, userland, addr, value)
              }

              for (const [addr, value] of codes) {
                await storageManager.setAccountCode(trx, userland, addr, value)
              }
            }

            // commit any child states below this one
            for (const [userland, symbol] of childCheckpoints) {
              await userland.persistState(symbol, trx)
            }

            if (isBase) await storageManager.commit(trx)
          } catch (err) {
            logger.warn(
              `Error persisting transaction state: ${err}, ${err.stack}`
            )
            await storageManager.revert(trx)
            throw err
          }
        } else {
          throw new InvalidCheckpointError()
        }
      },
    }
    stateTrackers.set(userland, stateTracker)

    stateManager = isKernel
      ? await mkWritableStateManager({
          stateManagerBase: await mkWeb3StateManager({
            web3Provider,
            blockNumber: baseBlockNumber,
          }),
          stateTracker,
        })
      : await mkUserlandStateManager({
          baseStateManager: parentStateManager,
          stateManager: await mkWritableStateManager({
            stateManagerBase: await mkDbStateManager({
              storageManager,
              userland,
              blockNumber: baseBlockNumber,
            }),
            stateTracker,
          }),
        })

    const userlandChildren = await storageManager.getUserlandChildren(
      baseBlockNumber + 1,
      userland
    )
    childStateTrackers = await Promise.all(
      [...userlandChildren].map(
        async address =>
          await mkTracker({
            userland: address,
            parentStateManager: stateManager,
          })
      )
    )

    return stateTracker
  }

  await mkTracker({
    userland: null,
    parentStateManager: null,
  })
  return stateTrackers.get(baseUserland)
}
