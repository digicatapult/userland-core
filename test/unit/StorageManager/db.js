const { describe, before, it } = require('mocha')
const sinon = require('sinon')
const { expect } = require('chai')
const errors = require('../../../lib/StorageManager/errors')

const mkStorageManager = require('../../../lib/StorageManager/db')

const mkDbMock = (env, options = {}) => {
  const { result, commit = sinon.stub(), rollback = sinon.stub() } = options
  const methods = [
    'select',
    'innerJoin',
    'leftJoin',
    'where',
    'orderBy',
    'transacting',
    'limit',
    'update',
    'insert',
    'from',
    'raw',
    'min',
  ]
  env.calls = []
  env.trx = {
    commit,
    rollback,
  }
  let db = null
  const fn = name => {
    const res = (...args) => {
      env.calls.push([name, ...args])

      if (typeof args[0] === 'function') {
        args[0].call(fn('db')())
      }
      methods.map(method => (res[method] = fn(method)))
      return res
    }

    res.transaction = cb => cb(env.trx)
    res.then = resolve => resolve(result)
    return res
  }
  db = fn('db')
  db.migrate = {
    latest: sinon.stub().resolves(),
  }

  return db
}

describe('StorageManager', () => {
  const readTest = (call, table, dbRes, expectation) => {
    const env = {}
    before(async () => {
      const db = mkDbMock(env, { result: dbRes })
      const instance = mkStorageManager({ db })
      env.res = await call(instance)
    })

    it('should exist', () => {
      expect(env.res).equal(expectation)
    })

    it('should query the correct table', () => {
      expect(env.calls[0]).deep.equal(['db', `${table} AS s`])
    })

    it('should filter the query correctly', () => {
      const whereCalls = env.calls.filter(call => call[0] === 'where')
      expect(whereCalls.slice(0, 3)).deep.equal([
        ['where', 'u.address', 'userland'],
        ['where', 'uc.address', 'account'],
        ['where', 's.block_number', '<=', 'blockNumber'],
      ])
    })

    return env
  }

  describe('accountExists', () => {
    describe('exists', () => {
      const env = {}
      before(async () => {
        const db = mkDbMock(env, { result: [{}] })
        const instance = mkStorageManager({ db })
        env.res = await instance.accountExists(
          'blockNumber',
          'userland',
          'account'
        )
      })

      it('should exist', () => {
        expect(env.res).equal(true)
      })

      it('should query the correct table', () => {
        expect(env.calls[0]).deep.equal(['db', 'tbl_userlands AS u'])
      })

      it('should filter the query correctly', () => {
        const whereCalls = env.calls.filter(call => call[0] === 'where')
        expect(whereCalls.slice(0, 3)).deep.equal([
          ['where', 'u.address', 'userland'],
          ['where', 'uc.address', 'account'],
          ['where', 'uc.block_number', '<=', 'blockNumber'],
        ])
      })
    })

    describe("doesn't exist", () => {
      const env = {}
      before(async () => {
        const db = mkDbMock(env, { result: [] })
        const instance = mkStorageManager({ db })
        env.res = await instance.accountExists(
          'blockNumber',
          'userland',
          'account'
        )
      })

      it('should exist', () => {
        expect(env.res).equal(false)
      })

      it('should query the correct table', () => {
        expect(env.calls[0]).deep.equal(['db', 'tbl_userlands AS u'])
      })

      it('should filter the query correctly', () => {
        const whereCalls = env.calls.filter(call => call[0] === 'where')
        expect(whereCalls.slice(0, 3)).deep.equal([
          ['where', 'u.address', 'userland'],
          ['where', 'uc.address', 'account'],
          ['where', 'uc.block_number', '<=', 'blockNumber'],
        ])
      })
    })
  })

  describe('getAccountState', () => {
    describe('exists', () => {
      const env = readTest(
        instance =>
          instance.getAccountState('blockNumber', 'userland', 'account', 'key'),
        'tbl_userland_contract_state',
        [{ result: 'foo' }],
        'foo'
      )

      it('should filter the key correctly', () => {
        const whereCalls = env.calls.filter(call => call[0] === 'where')
        expect(whereCalls.slice(3, 4)).deep.equal([
          ['where', 's.state_key', 'key'],
        ])
      })
    })

    describe("doesn't exist", () => {
      const env = readTest(
        instance =>
          instance.getAccountState('blockNumber', 'userland', 'account', 'key'),
        'tbl_userland_contract_state',
        [],
        null
      )

      it('should filter the key correctly', () => {
        const whereCalls = env.calls.filter(call => call[0] === 'where')
        expect(whereCalls.slice(3, 4)).deep.equal([
          ['where', 's.state_key', 'key'],
        ])
      })
    })
  })

  describe('getAccountBalance', () => {
    describe('exists', () => {
      readTest(
        instance =>
          instance.getAccountBalance('blockNumber', 'userland', 'account'),
        'tbl_userland_contract_balance',
        [{ result: 'foo' }],
        'foo'
      )
    })

    describe("doesn't exist", () => {
      readTest(
        instance =>
          instance.getAccountBalance('blockNumber', 'userland', 'account'),
        'tbl_userland_contract_balance',
        [],
        null
      )
    })
  })

  describe('getAccountCode', () => {
    describe('exists', () => {
      readTest(
        instance =>
          instance.getAccountCode('blockNumber', 'userland', 'account'),
        'tbl_userland_contract_code',
        [{ result: 'foo' }],
        'foo'
      )
    })

    describe("doesn't exist", () => {
      readTest(
        instance =>
          instance.getAccountCode('blockNumber', 'userland', 'account'),
        'tbl_userland_contract_code',
        [],
        null
      )
    })
  })

  describe('getAccountNonce', () => {
    describe('exists', () => {
      readTest(
        instance =>
          instance.getAccountNonce('blockNumber', 'userland', 'account'),
        'tbl_userland_contract_nonce',
        [{ result: 'foo' }],
        'foo'
      )
    })

    describe("doesn't exist", () => {
      readTest(
        instance =>
          instance.getAccountNonce('blockNumber', 'userland', 'account'),
        'tbl_userland_contract_nonce',
        [],
        null
      )
    })
  })

  describe('startTransaction', () => {
    describe('simple', () => {
      const env = {}
      before(async () => {
        const db = mkDbMock(env)
        const sm = mkStorageManager({ db })
        env.result = await sm.startTransaction()
      })

      it('should return a symbol', () => {
        expect(env.result).to.be.a('symbol')
      })
    })

    describe('with existing transaction', () => {
      const env = {}
      before(async () => {
        const db = mkDbMock(env)
        const sm = mkStorageManager({ db })
        await sm.startTransaction()
        try {
          await sm.startTransaction()
        } catch (err) {
          env.err = err
        }
      })

      it('should error with TransactionInProgressError', () => {
        expect(env.err).instanceOf(errors.TransactionInProgressError)
      })
    })
  })

  const transactionTests = fn => {
    const test = (fn, error) => () => {
      const env = {}
      before(async () => {
        const db = mkDbMock(env, { result: [{ id: 42 }] })
        const sm = mkStorageManager({ db })
        try {
          await fn(sm)
        } catch (err) {
          env.err = err
        }
      })

      if (error) {
        it(`should error with ${error.name}`, () => {
          expect(env.err).instanceOf(error)
        })
      } else {
        it('should not error', () => {
          expect(env.err).equal(undefined)
        })
      }
    }

    describe(
      'while not in a transaction',
      test(fn, errors.TransactionNotStartedError)
    )

    describe(
      'with an invalid transaction',
      test(async instance => {
        await instance.startTransaction()
        return fn(instance, Symbol())
      }, errors.InvalidTransactionError)
    )

    describe(
      'with a valid transaction',
      test(async instance => {
        const trx = await instance.startTransaction()
        return fn(instance, trx)
      })
    )
  }

  describe('commit', () => {
    transactionTests((instance, trx) => instance.commit(trx))

    describe('happy path', () => {
      const env = {}
      before(async () => {
        const db = mkDbMock(env)
        const sm = mkStorageManager({ db })

        const trx = await sm.startTransaction()
        await sm.commit(trx)
        await sm.startTransaction()
      })

      it('should update the correct table', () => {
        expect(env.calls[0]).deep.equal(['db', 'tbl_userlands'])
      })

      it('should call commit', () => {
        expect(env.trx.commit.calledOnce).equal(true)
        expect(env.trx.commit.firstCall.args).deep.equal([])
      })

      it('should not call rollback', () => {
        expect(env.trx.rollback.called).equal(false)
      })
    })

    describe('exception on commit', () => {
      const env = {}
      before(async () => {
        const db = mkDbMock(env, { commit: sinon.stub().rejects() })
        const sm = mkStorageManager({ db })

        const trx = await sm.startTransaction()
        await sm.commit(trx)
        await sm.startTransaction()
      })

      it('should call commit', () => {
        expect(env.trx.commit.calledOnce).equal(true)
        expect(env.trx.commit.firstCall.args).deep.equal([])
      })

      it('should call rollback', () => {
        expect(env.trx.rollback.calledOnce).equal(true)
        expect(env.trx.rollback.firstCall.args).deep.equal([])
      })
    })
  })

  describe('revert', () => {
    transactionTests((instance, trx) => instance.revert(trx))

    describe('happy path', () => {
      const env = {}
      before(async () => {
        const db = mkDbMock(env)
        const sm = mkStorageManager({ db })

        const trx = await sm.startTransaction()
        await sm.revert(trx)
        await sm.startTransaction()
      })

      it('should call rollback', () => {
        expect(env.trx.rollback.calledOnce).equal(true)
        expect(env.trx.rollback.firstCall.args).deep.equal([])
      })
    })

    describe('exception on rollback', () => {
      const env = {}
      before(async () => {
        const db = mkDbMock(env, { rollback: sinon.stub().rejects() })
        const sm = mkStorageManager({ db })

        const trx = await sm.startTransaction()
        await sm.revert(trx)
        await sm.startTransaction()
      })

      it('should call rollback', () => {
        expect(env.trx.rollback.calledOnce).equal(true)
        expect(env.trx.rollback.firstCall.args).deep.equal([])
      })
    })
  })

  const setTests = (fn, error = errors.InvalidUserlandContractError) => {
    describe('with missing contract', function() {
      const env = {}
      before(async () => {
        const db = mkDbMock(env, { result: [] })
        const sm = mkStorageManager({ db })
        const tx = await sm.startTransaction()
        try {
          await fn(sm, tx)
        } catch (err) {
          env.err = err
        }
      })

      it(`should error with InvalidUserlandContractError`, () => {
        expect(env.err).instanceOf(error)
      })
    })
  }

  // the below tests could be improved but it would require improvements to the mock.
  // for now just test the transaction tests
  describe('setAccountState', () => {
    transactionTests((instance, trx) => instance.setAccountState(trx))
    setTests((instance, trx) => instance.setAccountState(trx))
  })

  describe('setAccountBalance', () => {
    transactionTests((instance, trx) => instance.setAccountBalance(trx))
    setTests((instance, trx) => instance.setAccountBalance(trx))
  })

  describe('setAccountCode', () => {
    transactionTests((instance, trx) => instance.setAccountCode(trx))
    setTests((instance, trx) => instance.setAccountCode(trx))
  })

  describe('setAccountNonce', () => {
    transactionTests((instance, trx) => instance.setAccountNonce(trx))
    setTests((instance, trx) => instance.setAccountNonce(trx))
  })

  describe('clearAccountState', () => {
    transactionTests((instance, trx) => instance.clearAccountState(trx))
    setTests(
      (instance, trx) => instance.clearAccountState(trx),
      errors.InvalidUserlandError
    )
  })

  describe('getLastProcessedBlockNumber', () => {
    describe('happy path', () => {
      const env = {}
      before(async () => {
        const db = mkDbMock(env, { result: [{ last_processed_block: 42 }] })
        const sm = mkStorageManager({ db })
        env.res = await sm.getLastProcessedBlockNumber()
      })

      it('should return 42', () => {
        expect(env.res).equal(42)
      })

      it('should query the correct table', () => {
        expect(env.calls[0]).deep.equal(['db', 'tbl_userlands'])
      })
    })

    describe('no configured userlands', () => {
      const env = {}
      before(async () => {
        const db = mkDbMock(env, { result: [] })
        const sm = mkStorageManager({ db })
        try {
          await sm.getLastProcessedBlockNumber()
        } catch (err) {
          env.err = err
        }
      })

      it('should error with NoConfiguredUserlandsError', () => {
        expect(env.err).instanceOf(errors.NoConfiguredUserlandsError)
      })
    })
  })

  describe('getUserland', () => {
    describe('happy path', () => {
      const env = {}
      before(async () => {
        env.result = Symbol()
        const db = mkDbMock(env, { result: [env.result] })
        const sm = mkStorageManager({ db })
        env.res = await sm.getUserland('foo')
      })

      it('should return the userland', () => {
        expect(env.res).equal(env.result)
      })

      it('should query the correct table', () => {
        expect(env.calls[0]).deep.equal(['db', 'tbl_userlands'])
      })

      it('should filter the query correctly', () => {
        const whereCalls = env.calls.filter(call => call[0] === 'where')
        expect(whereCalls).deep.equal([['where', { address: 'foo' }]])
      })
    })

    describe('no userland', () => {
      const env = {}
      before(async () => {
        const db = mkDbMock(env, { result: [] })
        const sm = mkStorageManager({ db })

        try {
          await sm.getUserland('foo')
        } catch (err) {
          env.err = err
        }
      })

      it('should error with InvalidUserlandError', () => {
        expect(env.err).instanceOf(errors.InvalidUserlandError)
      })
    })
  })

  describe('getUserlandChildren', () => {
    describe('happy path', () => {
      const env = {}
      before(async () => {
        env.result = [{ address: Symbol() }, { address: Symbol() }]
        const db = mkDbMock(env, { result: env.result })
        const sm = mkStorageManager({ db })
        env.res = await sm.getUserlandChildren(42, 'foo')
      })

      it("should return the userland's children", () => {
        expect(env.res).deep.equal([
          env.result[0].address,
          env.result[1].address,
        ])
      })

      it('should query the correct table', () => {
        expect(env.calls[0]).deep.equal(['db', 'tbl_userlands AS u1'])
      })

      it('should filter the query correctly', () => {
        const whereCalls = env.calls.filter(call => call[0] === 'where')
        expect(whereCalls).deep.equal([
          ['where', { 'u2.address': 'foo' }],
          ['where', 'u1.block_number', '<=', 42],
        ])
      })
    })

    describe('no results', () => {
      const env = {}
      before(async () => {
        const db = mkDbMock(env, { result: [] })
        const sm = mkStorageManager({ db })
        env.res = await sm.getUserlandChildren(42, 'foo')
      })

      it('should return empty array', () => {
        expect(env.res).deep.equal([])
      })
    })
  })
})
