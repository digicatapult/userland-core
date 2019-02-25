const { describe, before, it } = require('mocha')
const { noCallThru: proxyquire } = require('proxyquire')
const sinon = require('sinon')
const { expect } = require('chai')
const { wrapCall } = require('../../utils')
const errors = require('../../../lib/StateManager/errors')

const path = '../../../lib/StateManager/web3StateManager'

const mkStubs = overrides => {
  const stubs = {
    getBlockNumber: overrides.getBlockNumber || sinon.stub().yields(null, 1),
    getBalance: overrides.getBalance || sinon.stub().yields(null, 12648430), // 0xC0FFEE
    getTransactionCount:
      overrides.getTransactionCount || sinon.stub().yields(null, 1000),
    getCode: overrides.getCode || sinon.stub().yields(null, '0xC0FFEE'),
    getBlock:
      overrides.getBlock || sinon.stub().yields(null, { hash: '0xC0FFEE' }),
    getStorageAt:
      overrides.getStorageAt || sinon.stub().yields(null, '0xC0FFEE'),
    web3: sinon.spy(function() {
      return {
        eth: {
          getBlockNumber: stubs.getBlockNumber,
          getCode: stubs.getCode,
          getBalance: stubs.getBalance,
          getTransactionCount: stubs.getTransactionCount,
          getBlock: stubs.getBlock,
          getStorageAt: stubs.getStorageAt,
        },
      }
    }),
    account: sinon.spy(function(obj) {
      return obj
    }),
    keccak: sinon.stub().returns('hash'),
  }

  return stubs
}

const setupStateManager = async (env, stubOverrides = {}) => {
  env.stubs = mkStubs(stubOverrides)
  env.web3Provider = {}

  const stateManager = proxyquire()(path, {
    web3: env.stubs.web3,
    'ethereumjs-vm': {
      deps: {
        Account: env.stubs.account,
        ethUtil: {
          keccak: env.stubs.keccak,
          bufferToHex: buf => `0x${buf.toString('hex').toLowerCase()}`,
          toBuffer: num => {
            if (typeof num === 'number') {
              let s = `0x${num.toString(16)}`.slice(2)
              s = s.length % 2 === 1 ? `0${s}` : s
              return Buffer.from(s, 'hex')
            } else {
              return Buffer.from(num.slice(2), 'hex')
            }
          },
          KECCAK256_NULL:
            'c5d2460186f7233c927e7db2dcc703c0e500b653ca82273b7bfad8045d85a470',
        },
      },
    },
  })

  return await stateManager({
    web3Provider: env.web3Provider,
    blockNumber: 1,
  })
}

const defaultAccount = Buffer.from('ABCDEF', 'hex')
const defaultAccountHex = '0xabcdef'

describe('Web3 StateManager', function() {
  describe('ctor', function() {
    describe('with valid blocknumber', function() {
      const env = {}
      before(async function() {
        env.stateManager = await setupStateManager(env)
      })

      it('should construct web3 correctly', function() {
        const stub = env.stubs.web3
        expect(stub.calledOnce).to.equal(true)
        expect(stub.calledWithNew()).to.equal(true)
        expect(stub.firstCall.args[0]).to.equal(env.web3Provider)
      })

      it('should get the current block number', function() {
        const stub = env.stubs.getBlockNumber
        expect(stub.calledOnce).to.equal(true)
      })

      it('should return a state manager instance', function() {
        expect(env.stateManager).to.be.an('object')
      })
    })

    describe('with invalid blocknumber', function() {
      const env = {}
      before(async function() {
        env.stubs = mkStubs({})
        env.web3Provider = {}

        const mkStateManager = proxyquire()(path, {
          web3: env.stubs.web3,
        })

        try {
          await mkStateManager({
            web3Provider: env.web3Provider,
            blockNumber: 2,
          })
        } catch (err) {
          env.err = err
        }
      })

      it('should throw', function() {
        expect(env.err).to.be.an.instanceof(errors.InvalidBlockNumberError)
      })
    })
  })

  describe('getContractCode', function() {
    describe('happy path', function() {
      const env = {}
      before(async function() {
        const stateManager = await setupStateManager(env)
        await wrapCall(env, stateManager.getContractCode)(defaultAccount)
      })

      it('should call eth.getCode correctly', function() {
        const stub = env.stubs.getCode
        expect(stub.calledOnce).to.equal(true)
        expect(stub.firstCall.args[0]).to.equal(defaultAccountHex)
        expect(stub.firstCall.args[1]).to.equal(1)
      })

      it('should not error', function() {
        expect(env.err).to.equal(undefined)
      })

      it('should return the contract code as a buffer', function() {
        expect(env.res).to.be.an.instanceof(Buffer)
        expect([...env.res]).to.deep.equal([192, 255, 238])
      })
    })

    describe('getCode returns "0x"', function() {
      const env = {}
      before(async function() {
        const stateManager = await setupStateManager(env, {
          getCode: sinon.stub().yields(null, '0x'),
        })

        await wrapCall(env, stateManager.getContractCode)(defaultAccount)
      })

      it('should not error', function() {
        expect(env.err).to.equal(undefined)
      })

      it('should return null', function() {
        expect(env.res).to.equal(null)
      })
    })

    describe('on error', function() {
      const env = {}
      before(async function() {
        const stateManager = await setupStateManager(env, {
          getCode: sinon.stub().yields('Error'),
        })
        await wrapCall(env, stateManager.getContractCode)(defaultAccount)
      })

      it('should pass through error', function() {
        expect(env.err).to.equal('Error')
      })
    })
  })

  describe('getAccount', function() {
    describe('happy path', function() {
      const env = {}
      before(async function() {
        const stateManager = await setupStateManager(env)
        await wrapCall(env, stateManager.getAccount)(defaultAccount)
      })

      it('should call eth.getBalance correctly', function() {
        const stub = env.stubs.getBalance
        expect(stub.calledOnce).to.equal(true)
        expect(stub.firstCall.args[0]).to.equal(defaultAccountHex)
        expect(stub.firstCall.args[1]).to.equal(1)
      })

      it('should call eth.getCode correctly', function() {
        const stub = env.stubs.getCode
        expect(stub.calledOnce).to.equal(true)
        expect(stub.firstCall.args[0]).to.equal(defaultAccountHex)
        expect(stub.firstCall.args[1]).to.equal(1)
      })

      it('should call eth.getTransactionCount correctly', function() {
        const stub = env.stubs.getTransactionCount
        expect(stub.calledOnce).to.equal(true)
        expect(stub.firstCall.args[0]).to.equal(defaultAccountHex)
        expect(stub.firstCall.args[1]).to.equal(1)
      })

      it('should not error', function() {
        expect(env.err).to.equal(undefined)
      })

      it('should return an ethereumjs-account Account', function() {
        expect(env.res.balance).to.be.an.instanceof(Buffer)
        expect([...env.res.balance]).to.deep.equal([192, 255, 238])

        expect(env.res.nonce).to.be.an.instanceof(Buffer)
        expect([...env.res.nonce]).to.deep.equal([3, 232])

        expect(env.res.codeHash).to.equal('hash')
      })
    })

    describe('with zero balance', function() {
      const env = {}
      before(async function() {
        const stateManager = await setupStateManager(env, {
          getBalance: sinon.stub().yields(null, 0),
        })
        await wrapCall(env, stateManager.getAccount)(defaultAccount)
      })

      it('should return an ethereumjs-account Account', function() {
        expect(env.res.balance).to.be.an.instanceof(Buffer)
        expect([...env.res.balance]).to.deep.equal([])

        expect(env.res.nonce).to.be.an.instanceof(Buffer)
        expect([...env.res.nonce]).to.deep.equal([3, 232])

        expect(env.res.codeHash).to.equal('hash')
      })
    })

    describe('with string balance', function() {
      const env = {}
      before(async function() {
        const stateManager = await setupStateManager(env, {
          getBalance: sinon.stub().yields(null, '0x01'),
        })
        await wrapCall(env, stateManager.getAccount)(defaultAccount)
      })

      it('should return an ethereumjs-account Account', function() {
        expect(env.res.balance).to.be.an.instanceof(Buffer)
        expect([...env.res.balance]).to.deep.equal([1])

        expect(env.res.nonce).to.be.an.instanceof(Buffer)
        expect([...env.res.nonce]).to.deep.equal([3, 232])

        expect(env.res.codeHash).to.equal('hash')
      })
    })

    describe('with object balance', function() {
      const env = {}
      before(async function() {
        const stateManager = await setupStateManager(env, {
          getBalance: sinon
            .stub()
            .yields(null, { toString: base => `${base}` }),
        })
        await wrapCall(env, stateManager.getAccount)(defaultAccount)
      })

      it('should return an ethereumjs-account Account', function() {
        expect(env.res.balance).to.be.an.instanceof(Buffer)
        expect([...env.res.balance]).to.deep.equal([22]) // 0x16 === 22

        expect(env.res.nonce).to.be.an.instanceof(Buffer)
        expect([...env.res.nonce]).to.deep.equal([3, 232])

        expect(env.res.codeHash).to.equal('hash')
      })
    })

    describe('with zero code', function() {
      const env = {}
      before(async function() {
        const stateManager = await setupStateManager(env, {
          getCode: sinon.stub().yields(null, '0x'),
        })
        await wrapCall(env, stateManager.getAccount)(defaultAccount)
      })

      it('should return the zero code hash', function() {
        expect(env.res.codeHash).to.equal(
          'c5d2460186f7233c927e7db2dcc703c0e500b653ca82273b7bfad8045d85a470'
        )
      })
    })

    const mkErrorCase = stubName => {
      describe(`on error in ${stubName}`, function() {
        const env = {}
        before(async function() {
          const stateManager = await setupStateManager(env, {
            [stubName]: sinon.stub().yields('Error'),
          })
          await wrapCall(env, stateManager.getAccount)(defaultAccount)
        })

        it('should pass through error', function() {
          expect(env.err).to.equal('Error')
        })
      })
    }

    mkErrorCase('getCode')
    mkErrorCase('getBalance')
    mkErrorCase('getTransactionCount')
  })

  describe('getContractStorage', function() {
    describe('happy path', function() {
      const env = {}
      before(async function() {
        const stateManager = await setupStateManager(env)
        await wrapCall(
          env,
          stateManager.getContractStorage
        )(defaultAccount, Buffer.from([1]))
      })

      it('should call eth.getStorageAt correctly', function() {
        const stub = env.stubs.getStorageAt
        expect(stub.calledOnce).to.equal(true)
        expect(stub.firstCall.args[0]).to.equal(defaultAccountHex, '0x01')
      })

      it('should not error', function() {
        expect(env.err).to.equal(undefined)
      })

      it('should return a Buffer', function() {
        expect(env.res).to.be.an.instanceof(Buffer)
        expect([...env.res]).to.deep.equal([192, 255, 238])
      })
    })

    describe('on error in getStorageAt', function() {
      const env = {}
      before(async function() {
        const stateManager = await setupStateManager(env, {
          getStorageAt: sinon.stub().yields('Error'),
        })
        await wrapCall(
          env,
          stateManager.getContractStorage
        )(defaultAccount, Buffer.from([1]))
      })

      it('should pass through error', function() {
        expect(env.err).to.equal('Error')
      })
    })
  })

  describe('accountIsEmpty', function() {
    describe('non-empty account', function() {
      const env = {}
      before(async function() {
        const stateManager = await setupStateManager(env)
        await wrapCall(env, stateManager.accountIsEmpty)(defaultAccount)
      })

      it('should return true', function() {
        expect(env.res).to.equal(false)
      })
    })

    describe('empty account', function() {
      const env = {}
      before(async function() {
        const stateManager = await setupStateManager(env, {
          getCode: sinon.stub().yields(null, '0x'),
          getBalance: sinon.stub().yields(null, '0x'),
          getTransactionCount: sinon.stub().yields(null, '0x'),
        })
        await wrapCall(env, stateManager.accountIsEmpty)(defaultAccount)
      })

      it('should return true', function() {
        expect(env.res).to.equal(true)
      })
    })

    const mkErrorCase = stubName => {
      describe(`on error in ${stubName}`, function() {
        const env = {}
        before(async function() {
          const stateManager = await setupStateManager(env, {
            [stubName]: sinon.stub().yields('Error'),
          })
          await wrapCall(env, stateManager.accountIsEmpty)(defaultAccount)
        })

        it('should pass through error', function() {
          expect(env.err).to.equal('Error')
        })
      })
    }

    mkErrorCase('getCode')
    mkErrorCase('getBalance')
    mkErrorCase('getTransactionCount')
  })

  const mkOperationErrorCases = method => {
    describe(`${method} async`, function() {
      const env = {}
      before(async function() {
        const stateManager = await setupStateManager(env)
        await wrapCall(env, stateManager[method])()
      })

      it('should error', function() {
        expect(env.err).be.an.instanceof(errors.InvalidOperationError)
      })
    })

    describe(`${method} sync`, function() {
      const env = {}
      before(async function() {
        const stateManager = await setupStateManager(env)
        try {
          stateManager[method]()
        } catch (err) {
          env.err = err
        }
      })

      it('should error', function() {
        expect(env.err).be.an.instanceof(errors.InvalidOperationError)
      })
    })
  }

  mkOperationErrorCases('putAccount')
  mkOperationErrorCases('checkpoint')
  mkOperationErrorCases('commit')
  mkOperationErrorCases('revert')
  mkOperationErrorCases('putContractCode')
  mkOperationErrorCases('putContractStorage')
  mkOperationErrorCases('clearContractStorage')
  mkOperationErrorCases('cleanupTouchedAccounts')
})
