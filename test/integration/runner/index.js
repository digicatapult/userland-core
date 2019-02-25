const { describe, before, it } = require('mocha')
const { expect } = require('chai')
const EthereumTx = require('ethereumjs-tx/fake')

const mkLogger = require('./logger')
const { populateDb, readDb } = require('./db')
const { mkWeb3Provider, accounts } = require('./web3Provider')

const { startUserland, initializeDb } = require('../../../lib/index')

const waitForEvent = (context, event, matcher = () => true) => {
  return new Promise(resolve => {
    context.on(event, (...args) => {
      if (matcher(...args)) resolve()
    })
  })
}

const logAppEvents = env => {
  env.events = []
  ;[
    'userlandCall',
    'runTransaction',
    'runCall',
    'step',
    'startProcessBlock',
    'finishProcessBlock',
  ].forEach(e => {
    env.userland.on(e, obj => {
      env.events.push({
        event: e,
        args: obj,
      })
    })
  })
}

const objAssert = (testObj, envObj) => {
  for (const [key, val] of Object.entries(testObj)) {
    if (val !== null && typeof val === 'object') {
      objAssert(val, envObj[key])
    } else {
      expect(val).to.equal(envObj[key])
    }
  }
}

const runTest = async test => {
  const run = test.only
    ? (...args) => describe.only(...args)
    : test.skip
    ? (...args) => describe.skip(...args)
    : describe

  run(test.name, function() {
    const env = {}
    before(async () => {
      env.db = await initializeDb({
        clientType: 'sqlite3',
        connectionString: ':memory:',
      })

      await populateDb(env.db, test)
      const { web3Provider, sendAsync } = await mkWeb3Provider()
      env.web3Provider = web3Provider
      env.logger = mkLogger()
      env.options = { confirmationDepth: 0 }

      env.userland = await startUserland(env)
      logAppEvents(env)

      await waitForEvent(env.userland, 'finishProcessBlock', obj => {
        return obj.blockNumber === 0
      })

      env.states = []
      const { blocks } = test
      for (let blockIndex = 0; blockIndex < blocks.length; blockIndex++) {
        const block = blocks[blockIndex]
        // run web3 block
        for (const tx of block.transactions) {
          await sendAsync({
            method: 'eth_sendTransaction',
            params: tx,
          })
        }

        const blockProcessPromise = waitForEvent(
          env.userland,
          'finishProcessBlock',
          obj => {
            return obj.blockNumber === blockIndex + 1
          }
        )

        await sendAsync({
          method: 'evm_mine',
          params: [],
        })

        await blockProcessPromise
      }

      if (test.call) {
        const { userland, tx } = test.call
        const ethTx = new EthereumTx({
          nonce: `0x${tx.nonce.toString(16)}`,
          gasLimit: tx.gas,
          gasPrice: tx.gasPrice,
          to: tx.to,
          from: tx.from,
          value: tx.value,
          data: tx.data,
        })
        env.callResult = await env.userland.runCall(userland, ethTx)
      }

      env.result = await readDb(env.db)
    })

    after(async () => {
      await env.userland.stop()
      await env.db.migrate.rollback()
      await env.db.destroy()
    })

    if (test.expect.events) {
      const expectedEvents = test.expect.events
      it('should have emitted the correct events', () => {
        for (let i = 0; i < expectedEvents.length; i++) {
          if (expectedEvents[i]) {
            objAssert(expectedEvents[i], env.events[i])
          }
        }
      })
    }

    for (const [ulAddress, ul] of Object.entries(test.expect.accounts)) {
      if (ul.shouldNotExist) {
        it(`should not register userland ${ulAddress}`, () => {
          expect(env.result).not.property(ulAddress)
        })
      } else {
        ;['blockNumber', 'lastProcessedBlock', 'transactionGasLimit'].forEach(
          s => {
            if (ul[s] !== undefined) {
              it(`userland ${ulAddress} should have correct value for ${s}`, () => {
                expect(env.result[ulAddress][s]).equal(ul[s])
              })
            }
          }
        )

        if (ul.contracts) {
          for (const [cAddress, contract] of Object.entries(ul.contracts)) {
            if (contract.notExist) {
              it(`should not contain contract ${cAddress} in userland ${ulAddress}`, () => {
                expect(env.result[ulAddress].contracts).not.property(cAddress)
              })
            } else {
              it(`should contain contract ${cAddress} in userland ${ulAddress}`, () => {
                expect(env.result[ulAddress].contracts).property(cAddress)
              })
              ;['nonce', 'code', 'balance'].forEach(s => {
                if (contract[s] !== undefined) {
                  it(`contract ${cAddress} in userland ${ulAddress} should have correct value for ${s}`, () => {
                    const resUl = env.result[ulAddress]
                    const resC = resUl.contracts[cAddress]
                    expect(resC[s]).equal(contract[s])
                  })
                }
              })

              if (contract.state) {
                for (const [sKey, sValue] of Object.entries(contract.state)) {
                  it(`contract ${cAddress} in userland ${ulAddress} should have correct value for state key ${sKey}`, () => {
                    const resUl = env.result[ulAddress]
                    const resC = resUl.contracts[cAddress]
                    expect(resC.state[sKey]).equal(sValue)
                  })
                }
              }
            }
          }
        }
      }
    }

    if (test.expect.call) {
      const expected = test.expect.call
      it('should have returned the correct result for call', function() {
        const returned = `0x${env.callResult.result.toString('hex')}`
        expect(returned).to.equal(expected.result)
      })
    }
  })
}

module.exports = { runTest, accounts }
