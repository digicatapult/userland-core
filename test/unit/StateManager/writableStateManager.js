const { describe, before, it } = require('mocha')
const { noCallThru: proxyquire } = require('proxyquire')
const sinon = require('sinon')
const { expect } = require('chai')
const { wrapCall, assertNoError } = require('../../utils')
const errors = require('../../../lib/StateManager/errors')

const path = '../../../lib/StateManager/writableStateManager'
const coffee = Buffer.from('C0FFEE', 'hex')
const doodad = Buffer.from('D00DAD', 'hex')

const baseStorage = Buffer.from('f0', 'hex')
const baseCode = Buffer.from('f1', 'hex')
const baseCodeHash = Buffer.from('01f1', 'hex')
const baseNonce = Buffer.from('f2', 'hex')
const baseBalance = Buffer.from('f3', 'hex')

const newCodeHash = Buffer.from('01b1', 'hex')
const newNonce = Buffer.from('b2', 'hex')
const newBalance = Buffer.from('b3', 'hex')

const mkStubs = overrides => {
  const stubs = {
    getAccount: sinon.stub().resolves({
      codeHash: baseCodeHash,
      nonce: baseNonce,
      balance: baseBalance,
    }),
    getContractCode: sinon.stub().resolves(baseCode),
    getContractStorage: sinon.stub().resolves(baseStorage),
    containsAddress: sinon.stub().returns(true),
    getAccountState: sinon.stub().resolves('a0'),
    setAccountState: sinon.stub().resolves(),
    clearAccountState: sinon.stub().resolves(),
    getAccountCode: sinon.stub().resolves('a1'),
    setAccountCode: sinon.stub().resolves(),
    getAccountNonce: sinon.stub().resolves('a2'),
    setAccountNonce: sinon.stub().resolves(),
    getAccountBalance: sinon.stub().resolves('a3'),
    setAccountBalance: sinon.stub().resolves(),
    accountIsCleared: sinon.stub().resolves(false),
    isEmpty: sinon.stub().returns(true),
    serialize: sinon.stub().returns('serialized'),
    account: sinon.spy(function() {
      this.isEmpty = stubs.isEmpty
      this.serialize = stubs.serialize
      this.codeHash = newCodeHash
      this.nonce = newNonce
      this.balance = newBalance
    }),
    keccak: b => Buffer.from([1, ...b]),
    commitState: sinon.stub().resolves(null),
    revertState: sinon.stub().resolves(null),
    checkpointState: sinon
      .stub()
      .onFirstCall()
      .returns(1)
      .onSecondCall()
      .returns(2)
      .onThirdCall()
      .returns(3),
    ...overrides,
  }

  return stubs
}

const mkExpectedAccount = stubs => {
  return {
    isEmpty: stubs.isEmpty,
    codeHash: newCodeHash,
    nonce: newNonce,
    balance: newBalance,
    serialize: stubs.serialize,
  }
}

const setupStateManager = async (env, stubOverrides = {}) => {
  env.stubs = mkStubs(stubOverrides)
  const stateManagerBase = {
    getContractCode: env.stubs.getContractCode,
    getAccount: env.stubs.getAccount,
    getContractStorage: env.stubs.getContractStorage,
  }
  const stateTracker = {
    userland: env.userland === undefined ? 'pmAddress' : env.userland,
    emptyValue: 'empty',
    containsAddress: env.stubs.containsAddress,
    getAccountState: env.stubs.getAccountState,
    setAccountState: env.stubs.setAccountState,
    clearAccountState: env.stubs.clearAccountState,
    getAccountBalance: env.stubs.getAccountBalance,
    setAccountBalance: env.stubs.setAccountBalance,
    getAccountNonce: env.stubs.getAccountNonce,
    setAccountNonce: env.stubs.setAccountNonce,
    getAccountCode: env.stubs.getAccountCode,
    setAccountCode: env.stubs.setAccountCode,
    commitState: env.stubs.commitState,
    checkpointState: env.stubs.checkpointState,
    revertState: env.stubs.revertState,
    accountIsCleared: env.stubs.accountIsCleared,
  }
  env.import = proxyquire()(path, {
    'ethereumjs-vm': {
      deps: {
        Account: env.stubs.account,
        ethUtil: {
          keccak: env.stubs.keccak,
        },
      },
    },
  })

  return await env.import({ stateManagerBase, stateTracker })
}

describe('Writable StateManager', function() {
  describe('getAccount', function() {
    describe('not empty nonce, balance and code', function() {
      const env = {}
      before(async function() {
        const stateManager = await setupStateManager(env)
        await wrapCall(env, stateManager.getAccount)(coffee)
      })

      it('should get code from stateTracker', function() {
        const stub = env.stubs.getAccountCode
        expect(stub.calledOnce).to.equal(true)
        expect(stub.firstCall.args[0]).to.equal('c0ffee')
      })

      it('should get nonce from stateTracker', function() {
        const stub = env.stubs.getAccountNonce
        expect(stub.calledOnce).to.equal(true)
        expect(stub.firstCall.args[0]).to.equal('c0ffee')
      })

      it('should get balance from stateTracker', function() {
        const stub = env.stubs.getAccountBalance
        expect(stub.calledOnce).to.equal(true)
        expect(stub.firstCall.args[0]).to.equal('c0ffee')
      })

      it('should not get the account from the base', function() {
        const stub = env.stubs.getAccount
        expect(stub.called).to.equal(false)
      })

      it('should construct an ethereumjs-account', function() {
        const stub = env.stubs.account
        expect(stub.calledOnce).to.equal(true)
        expect(stub.calledWithNew()).to.equal(true)
        expect(stub.firstCall.args[0]).to.deep.equal({
          balance: Buffer.from([0xa3]),
          nonce: Buffer.from([0xa2]),
          codeHash: Buffer.from([1, 0xa1]),
        })
      })

      it('should return the stateTracker value', function() {
        expect(env.res).to.deep.equal(mkExpectedAccount(env.stubs))
      })

      assertNoError(env)
    })

    describe('not empty nonce, balance, empty code', function() {
      const env = {}
      before(async function() {
        const stateManager = await setupStateManager(env, {
          getAccountCode: sinon.stub().resolves('empty'),
        })
        await wrapCall(env, stateManager.getAccount)(coffee)
      })

      it('should get the account from the base', function() {
        const stub = env.stubs.getAccount
        expect(stub.calledOnce).to.equal(true)
      })

      it('should construct an ethereumjs-account', function() {
        const stub = env.stubs.account
        expect(stub.calledOnce).to.equal(true)
        expect(stub.calledWithNew()).to.equal(true)
        expect(stub.firstCall.args[0]).to.deep.equal({
          balance: Buffer.from([0xa3]),
          nonce: Buffer.from([0xa2]),
          codeHash: baseCodeHash,
        })
      })

      it('should return the stateTracker value', function() {
        expect(env.res).to.deep.equal(mkExpectedAccount(env.stubs))
      })

      assertNoError(env)
    })

    describe('not empty nonce, code, empty balance', function() {
      const env = {}
      before(async function() {
        const stateManager = await setupStateManager(env, {
          getAccountBalance: sinon.stub().resolves('empty'),
        })
        await wrapCall(env, stateManager.getAccount)(coffee)
      })

      it('should get the account from the base', function() {
        const stub = env.stubs.getAccount
        expect(stub.calledOnce).to.equal(true)
      })

      it('should construct an ethereumjs-account', function() {
        const stub = env.stubs.account
        expect(stub.calledOnce).to.equal(true)
        expect(stub.calledWithNew()).to.equal(true)
        expect(stub.firstCall.args[0]).to.deep.equal({
          balance: baseBalance,
          nonce: Buffer.from([0xa2]),
          codeHash: Buffer.from([1, 0xa1]),
        })
      })

      it('should return the stateTracker value', function() {
        expect(env.res).to.deep.equal(mkExpectedAccount(env.stubs))
      })

      assertNoError(env)
    })

    describe('not empty nonce, balance, empty code', function() {
      const env = {}
      before(async function() {
        const stateManager = await setupStateManager(env, {
          getAccountCode: sinon.stub().resolves('empty'),
        })
        await wrapCall(env, stateManager.getAccount)(coffee)
      })

      it('should get the account from the base', function() {
        const stub = env.stubs.getAccount
        expect(stub.calledOnce).to.equal(true)
      })

      it('should construct an ethereumjs-account', function() {
        const stub = env.stubs.account
        expect(stub.calledOnce).to.equal(true)
        expect(stub.calledWithNew()).to.equal(true)
        expect(stub.firstCall.args[0]).to.deep.equal({
          balance: Buffer.from([0xa3]),
          nonce: Buffer.from([0xa2]),
          codeHash: baseCodeHash,
        })
      })

      it('should return the stateTracker value', function() {
        expect(env.res).to.deep.equal(mkExpectedAccount(env.stubs))
      })

      assertNoError(env)
    })

    describe('not empty code, balance, empty nonce', function() {
      const env = {}
      before(async function() {
        const stateManager = await setupStateManager(env, {
          getAccountNonce: sinon.stub().resolves('empty'),
        })
        await wrapCall(env, stateManager.getAccount)(coffee)
      })

      it('should get the account from the base', function() {
        const stub = env.stubs.getAccount
        expect(stub.calledOnce).to.equal(true)
      })

      it('should construct an ethereumjs-account', function() {
        const stub = env.stubs.account
        expect(stub.calledOnce).to.equal(true)
        expect(stub.calledWithNew()).to.equal(true)
        expect(stub.firstCall.args[0]).to.deep.equal({
          balance: Buffer.from([0xa3]),
          codeHash: Buffer.from([1, 0xa1]),
          nonce: baseNonce,
        })
      })

      it('should return the stateTracker value', function() {
        expect(env.res).to.deep.equal(mkExpectedAccount(env.stubs))
      })

      assertNoError(env)
    })
  })

  describe('putAccount', () => {
    describe('happy path', function() {
      const env = {}
      before(async function() {
        const stateManager = await setupStateManager(env)
        await wrapCall(env, stateManager.putAccount)(coffee, {
          serialize: sinon.stub().returns(doodad),
          nonce: 'new-nonce',
          balance: 'new-balance',
        })
      })

      it('should set the new account balance', function() {
        const stub = env.stubs.setAccountBalance
        expect(stub.calledOnce).to.equal(true)
        expect(stub.firstCall.args[0]).to.equal('c0ffee')
        expect(stub.firstCall.args[1]).to.equal('new-balance')
      })

      it('should set the new account nonce', function() {
        const stub = env.stubs.setAccountNonce
        expect(stub.calledOnce).to.equal(true)
        expect(stub.firstCall.args[0]).to.equal('c0ffee')
        expect(stub.firstCall.args[1]).to.equal('new-nonce')
      })

      it('should not set the new account code', function() {
        const stub = env.stubs.setAccountCode
        expect(stub.called).to.equal(false)
      })

      assertNoError(env)
    })
  })

  describe('getContractCode', function() {
    describe('non-empty value from stateTracker', function() {
      const env = {}
      before(async function() {
        const stateManager = await setupStateManager(env)

        await wrapCall(env, stateManager.getContractCode)(coffee)
      })

      it('should get code from stateTracker', function() {
        const stub = env.stubs.getAccountCode
        expect(stub.calledOnce).to.equal(true)
        expect(stub.firstCall.args[0]).to.equal('c0ffee')
      })

      it('should not get the account from the base', function() {
        const stub = env.stubs.getContractCode
        expect(stub.called).to.equal(false)
      })

      it('should return the null value', function() {
        expect(env.res).to.deep.equal(Buffer.from([0xa1]))
      })

      assertNoError(env)
    })

    describe('empty value from stateTracker', function() {
      const env = {}
      before(async function() {
        const stateManager = await setupStateManager(env, {
          getAccountCode: sinon.stub().resolves('empty'),
        })

        await wrapCall(env, stateManager.getContractCode)(coffee)
      })

      it('should get code from stateTracker', function() {
        const stub = env.stubs.getAccountCode
        expect(stub.calledOnce).to.equal(true)
        expect(stub.firstCall.args[0]).to.equal('c0ffee')
      })

      it('should get the account from the base', function() {
        const stub = env.stubs.getContractCode
        expect(stub.called).to.equal(true)
        expect(stub.firstCall.args[0]).to.equal(coffee)
      })

      it('should return the null value', function() {
        expect(env.res).to.deep.equal(baseCode)
      })

      assertNoError(env)
    })
  })

  describe('putContractCode', function() {
    const code = Buffer.from([1, 2, 3, 4])
    const env = {}
    before(async function() {
      const stateManager = await setupStateManager(env)
      await wrapCall(env, stateManager.putContractCode)(coffee, code)
    })

    it('should set the new account code in stateTracker', function() {
      const stub = env.stubs.setAccountCode
      expect(stub.calledOnce).to.equal(true)
      expect(stub.firstCall.args[0]).to.equal('c0ffee')
      expect(stub.firstCall.args[1]).to.equal('01020304')
    })

    assertNoError(env)
  })

  describe('getContractStorage', function() {
    describe('empty value from stateTracker', function() {
      const env = {}
      before(async function() {
        const stateManager = await setupStateManager(env, {
          getAccountState: sinon.stub().resolves('empty'),
        })

        await wrapCall(env, stateManager.getContractStorage)(coffee, doodad)
      })

      it('should get state from stateTracker', function() {
        const stub = env.stubs.getAccountState
        expect(stub.calledOnce).to.equal(true)
        expect(stub.firstCall.args[0]).to.equal('c0ffee')
        expect(stub.firstCall.args[1]).to.equal('d00dad')
      })

      it('should get the state from the base', function() {
        const stub = env.stubs.getContractStorage
        expect(stub.calledOnce).to.equal(true)
        expect(stub.firstCall.args[0]).to.equal(coffee)
        expect(stub.firstCall.args[1]).to.equal(doodad)
      })

      it('should return the value from base', function() {
        expect(env.res).to.equal(baseStorage)
      })

      assertNoError(env)
    })

    describe('non-empty value from stateTracker', function() {
      const env = {}
      before(async function() {
        const stateManager = await setupStateManager(env)
        await wrapCall(env, stateManager.getContractStorage)(coffee, doodad)
      })

      it('should get state from stateTracker', function() {
        const stub = env.stubs.getAccountState
        expect(stub.calledOnce).to.equal(true)
        expect(stub.firstCall.args[0]).to.equal('c0ffee')
        expect(stub.firstCall.args[1]).to.equal('d00dad')
      })

      it('should not get the account from the base', function() {
        const stub = env.stubs.getContractStorage
        expect(stub.called).to.equal(false)
      })

      it('should return the stateTracker value', function() {
        expect(env.res).to.deep.equal(Buffer.from([0xa0]))
      })

      assertNoError(env)
    })
  })

  describe('putContractStorage', function() {
    const value = Buffer.from([1, 2, 3, 4])
    const env = {}
    before(async function() {
      const stateManager = await setupStateManager(env)
      await wrapCall(
        env,
        stateManager.putContractStorage
      )(coffee, doodad, value)
    })

    it('should set the new storage state', function() {
      const stub = env.stubs.setAccountState
      expect(stub.calledOnce).to.equal(true)
      expect(stub.firstCall.args[0]).to.equal('c0ffee')
      expect(stub.firstCall.args[1]).to.equal('d00dad')
      expect(stub.firstCall.args[2]).to.equal('01020304')
    })

    assertNoError(env)
  })

  describe('clearContractStorage', function() {
    const env = {}
    before(async function() {
      const stateManager = await setupStateManager(env)
      await wrapCall(env, stateManager.clearContractStorage)(coffee)
    })

    it('should set the new storage state', function() {
      const stub = env.stubs.clearAccountState
      expect(stub.calledOnce).to.equal(true)
      expect(stub.firstCall.args[0]).to.equal('c0ffee')
    })

    assertNoError(env)
  })

  describe('accountIsEmpty', function() {
    describe('empty account, not cleared', function() {
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
        await wrapCall(env, stateManager.accountIsEmpty)(coffee)
      })

      it('should return true', function() {
        expect(env.res).to.equal(true)
      })

      assertNoError(env)
    })

    describe('empty account, cleared', function() {
      const env = {}
      before(async function() {
        const stateManager = await setupStateManager(env, {
          account: function() {
            this.nonce = ''
            this.balance = ''
            this.codeHash =
              'c5d2460186f7233c927e7db2dcc703c0e500b653ca82273b7bfad8045d85a470'
          },
          accountIsCleared: sinon.stub().resolves(true),
        })
        await wrapCall(env, stateManager.accountIsEmpty)(coffee)
      })

      it('should return true', function() {
        expect(env.res).to.equal(false)
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
          await wrapCall(env, stateManager.accountIsEmpty)(coffee)
        })

        it('should return true', function() {
          expect(env.res).to.equal(false)
        })

        assertNoError(env)
      })
    }
  })

  describe('checkpoints', function() {
    describe('committing both', function() {
      const env = {}
      before(async function() {
        const stateManager = await setupStateManager(env)
        await stateManager.checkpoint()
        await stateManager.checkpoint()
        await stateManager.checkpoint()

        await wrapCall({}, stateManager.commit)()
        await wrapCall({}, stateManager.commit)()
      })

      it('should have called checkpoint three times', function() {
        const stub = env.stubs.checkpointState
        expect(stub.calledThrice).to.equal(true)
      })

      it('should have called commit twice', function() {
        const stub = env.stubs.commitState
        expect(stub.calledTwice).to.equal(true)
        expect(stub.firstCall.args[0]).to.equal(3)
        expect(stub.secondCall.args[0]).to.equal(2)
      })

      assertNoError(env)
    })

    describe('commit then revert', function() {
      const env = {}
      before(async function() {
        const stateManager = await setupStateManager(env)
        await stateManager.checkpoint()
        await stateManager.checkpoint()
        await stateManager.checkpoint()

        await wrapCall({}, stateManager.commit)()
        await wrapCall({}, stateManager.revert)()
      })

      it('should have called commit first', function() {
        const stub = env.stubs.commitState
        expect(stub.calledOnce).to.equal(true)
        expect(stub.firstCall.args[0]).to.equal(3)
      })

      it('should have called revert second', function() {
        const stub = env.stubs.revertState
        expect(stub.calledOnce).to.equal(true)
        expect(stub.firstCall.args[0]).to.equal(2)
      })

      assertNoError(env)
    })

    describe('revert then commit', function() {
      const env = {}
      before(async function() {
        const stateManager = await setupStateManager(env)
        await stateManager.checkpoint()
        await stateManager.checkpoint()
        await stateManager.checkpoint()

        await wrapCall({}, stateManager.revert)()
        await wrapCall({}, stateManager.commit)()
      })

      it('should have called revert first', function() {
        const stub = env.stubs.revertState
        expect(stub.calledOnce).to.equal(true)
        expect(stub.firstCall.args[0]).to.equal(3)
      })

      it('should have called commit second', function() {
        const stub = env.stubs.commitState
        expect(stub.calledOnce).to.equal(true)
        expect(stub.firstCall.args[0]).to.equal(2)
      })

      assertNoError(env)
    })

    describe('reverting both', function() {
      const env = {}
      before(async function() {
        const stateManager = await setupStateManager(env)
        await stateManager.checkpoint()
        await stateManager.checkpoint()
        await stateManager.checkpoint()

        await wrapCall({}, stateManager.revert)()
        await wrapCall({}, stateManager.revert)()
      })

      it('should have called revert twice', function() {
        const stub = env.stubs.revertState
        expect(stub.calledTwice).to.equal(true)
        expect(stub.firstCall.args[0]).to.equal(3)
        expect(stub.secondCall.args[0]).to.equal(2)
      })

      assertNoError(env)
    })
  })

  describe('cleanupTouchedAccounts', function() {
    const env = {}
    before(async function() {
      const stateManager = await setupStateManager(env)
      await wrapCall(env, stateManager.cleanupTouchedAccounts)()
    })

    assertNoError(env)
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

  mkOperationErrorCases('getStateRoot')
})
