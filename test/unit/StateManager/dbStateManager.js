const { describe, before, it } = require('mocha')
const { noCallThru: proxyquire } = require('proxyquire')
const sinon = require('sinon')
const { expect } = require('chai')
const { wrapCall, assertNoError } = require('../../utils')
const { InvalidOperationError } = require('../../../lib/StateManager/errors')

const path = '../../../lib/StateManager/dbStateManager'

const mkStubs = overrides => {
  const stubs = {
    account: sinon.spy(function(obj) {
      return obj
    }),
    getAccountCode: sinon.stub().resolves('1234'),
    getAccountBalance: sinon.stub().resolves('5678'),
    getAccountNonce: sinon.stub().resolves('42'),
    getAccountState: sinon.stub().resolves('9abc'),
    keccak: sinon.stub().returns('hash'),
    ...overrides,
  }

  return stubs
}

const setupStateManager = async (env, stubOverrides = {}) => {
  env.stubs = mkStubs(stubOverrides)
  env.storageManager = {
    getAccountCode: env.stubs.getAccountCode,
    getAccountBalance: env.stubs.getAccountBalance,
    getAccountNonce: env.stubs.getAccountNonce,
    getAccountState: env.stubs.getAccountState,
  }

  const stateManager = proxyquire()(path, {
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
            } else if (num === null) {
              return Buffer.alloc(0)
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
    storageManager: env.storageManager,
    userland: '12345678',
    blockNumber: 13,
  })
}

const defaultAccount = Buffer.from('ABCDEF', 'hex')
const defaultAccountHex = 'abcdef'
const d00dad = Buffer.from('D00DAD', 'hex')
const d00dadHex = 'd00dad'

describe('dbStateManager', function() {
  describe('getContractCode', function() {
    describe('happy path', function() {
      const env = {}
      before(async function() {
        const stateManager = await setupStateManager(env)
        await wrapCall(env, stateManager.getContractCode)(defaultAccount)
      })

      it('should call db.getAccountState correctly', function() {
        const stub = env.stubs.getAccountCode
        expect(stub.calledOnce).to.equal(true)
        expect(stub.firstCall.args[0]).to.equal(13)
        expect(stub.firstCall.args[1]).to.equal('12345678')
        expect(stub.firstCall.args[2]).to.equal(defaultAccountHex)
      })

      it('should return the contract code as a buffer', function() {
        expect(env.res).to.be.an.instanceof(Buffer)
        expect([...env.res]).to.deep.equal([0x12, 0x34])
      })

      assertNoError(env)
    })
  })

  describe('getContractStorage', function() {
    describe('happy path', function() {
      const env = {}
      before(async function() {
        const stateManager = await setupStateManager(env)
        await wrapCall(
          env,
          stateManager.getContractStorage
        )(defaultAccount, d00dad)
      })

      it('should call db.getAccountState correctly', function() {
        const stub = env.stubs.getAccountState
        expect(stub.calledOnce).to.equal(true)
        expect(stub.firstCall.args[0]).to.equal(13)
        expect(stub.firstCall.args[1]).to.equal('12345678')
        expect(stub.firstCall.args[2]).to.equal(defaultAccountHex)
        expect(stub.firstCall.args[3]).to.equal(d00dadHex)
      })

      it('should return the contract code as a buffer', function() {
        expect(env.res).to.be.an.instanceof(Buffer)
        expect([...env.res]).to.deep.equal([0x9a, 0xbc])
      })

      assertNoError(env)
    })
  })

  describe('getAccount', function() {
    describe('happy path', function() {
      const env = {}
      before(async function() {
        const stateManager = await setupStateManager(env)
        await wrapCall(env, stateManager.getAccount)(defaultAccount)
      })

      it('should call db.getAccountCode correctly', function() {
        const stub = env.stubs.getAccountCode
        expect(stub.calledOnce).to.equal(true)
        expect(stub.firstCall.args[0]).to.equal(13)
        expect(stub.firstCall.args[1]).to.equal('12345678')
        expect(stub.firstCall.args[2]).to.equal(defaultAccountHex)
      })

      it('should call db.getAccountBalance correctly', function() {
        const stub = env.stubs.getAccountBalance
        expect(stub.calledOnce).to.equal(true)
        expect(stub.firstCall.args[0]).to.equal(13)
        expect(stub.firstCall.args[1]).to.equal('12345678')
        expect(stub.firstCall.args[2]).to.equal(defaultAccountHex)
      })

      it('should call db.getAccountNonce correctly', function() {
        const stub = env.stubs.getAccountNonce
        expect(stub.calledOnce).to.equal(true)
        expect(stub.firstCall.args[0]).to.equal(13)
        expect(stub.firstCall.args[1]).to.equal('12345678')
        expect(stub.firstCall.args[2]).to.equal(defaultAccountHex)
      })

      it('should hash the code', function() {
        const stub = env.stubs.keccak
        expect(stub.calledOnce).to.equal(true)
        expect(stub.firstCall.args[0]).to.deep.equal(Buffer.from([0x12, 0x34]))
      })

      it('should create the account correctly', function() {
        const stub = env.stubs.account
        expect(stub.calledOnce).to.equal(true)
        expect(stub.calledWithNew()).to.equal(true)
        expect(stub.firstCall.args[0]).to.deep.equal({
          balance: Buffer.from([0x56, 0x78]),
          nonce: Buffer.from([0x42]),
          codeHash: 'hash',
        })
      })

      it('should return the account', function() {
        expect(env.res).to.deep.equal({
          balance: Buffer.from([0x56, 0x78]),
          nonce: Buffer.from([0x42]),
          codeHash: 'hash',
        })
      })

      assertNoError(env)
    })
  })

  const buildErrorCase = function(name) {
    describe(name, function() {
      describe('always errors', function() {
        const env = {}
        before(async function() {
          const stateManager = await setupStateManager(env)
          try {
            await wrapCall(env, stateManager[name])(defaultAccount)
          } catch (err) {
            env.err = err
          }
        })

        it('should error with InvalidOperationError', function() {
          expect(env.err).instanceof(InvalidOperationError)
        })
      })
    })
  }

  describe('accountIsEmpty', function() {
    describe('empty account', function() {
      const env = {}
      before(async function() {
        const stateManager = await setupStateManager(env, {
          account: function() {
            this.nonce = ''
            this.balance = ''
            this.codeHash =
              'c5d2460186f7233c927e7db2dcc703c0e500b653ca82273b7bfad8045d85a470'
          },
        })
        await wrapCall(env, stateManager.accountIsEmpty)(defaultAccount)
      })

      it('should return true', function() {
        expect(env.res).to.equal(true)
      })

      assertNoError(env)
    })

    for (const test of ['nonce', 'balance', 'codeHash']) {
      describe(`non-empty account (${test})`, function() {
        const env = {}
        before(async function() {
          const stateManager = await setupStateManager(env, {
            account: function() {
              this.nonce = ''
              this.balance = ''
              this.codeHash =
                'c5d2460186f7233c927e7db2dcc703c0e500b653ca82273b7bfad8045d85a470'
              this[test] = 'test'
            },
          })
          await wrapCall(env, stateManager.accountIsEmpty)(defaultAccount)
        })

        it('should return true', function() {
          expect(env.res).to.equal(false)
        })

        assertNoError(env)
      })
    }
  })

  for (const test of [
    'putAccount',
    'putContractCode',
    'putContractStorage',
    'clearContractStorage',
    'checkpoint',
    'commit',
    'revert',
    'getStateRoot',
    'cleanupTouchedAccounts',
  ]) {
    buildErrorCase(test)
  }
})
