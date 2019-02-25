const { describe, before, it } = require('mocha')
const { expect } = require('chai')
const { noCallThru: proxyquire } = require('proxyquire')
const sinon = require('sinon')

const path = '../../lib/db'

const mkStubs = () => {
  const latest = sinon.stub().resolves()
  const result = {
    migrate: {
      latest,
    },
  }
  return {
    latest,
    result,
    knex: sinon.stub().returns(result),
  }
}

describe('db', function() {
  describe('using other db', function() {
    const env = {}
    before(async function() {
      env.stubs = mkStubs()
      const mkDb = proxyquire()(path, {
        knex: env.stubs.knex,
      })
      env.result = await mkDb({
        clientType: 'other',
        connectionString: 'connection_string',
      })
    })

    it('should have constructed the db correctly', function() {
      const stub = env.stubs.knex
      expect(stub.calledOnce).equal(true)
      expect(stub.firstCall.args[0]).deep.equal({
        client: 'other',
        connection: 'connection_string',
      })
    })

    it('should have migrated the database', function() {
      const stub = env.stubs.latest
      expect(stub.calledOnce).equal(true)
    })

    it('should have returned the result', function() {
      expect(env.result).equal(env.stubs.result)
    })
  })

  describe('using sqlite3', function() {
    const env = {}
    before(async function() {
      env.stubs = mkStubs()
      const mkDb = proxyquire()(path, {
        knex: env.stubs.knex,
      })
      env.result = await mkDb({
        clientType: 'sqlite3',
        connectionString: 'connection_string',
      })
    })

    it('should have constructed the db correctly', function() {
      const stub = env.stubs.knex
      expect(stub.calledOnce).equal(true)
      expect(stub.firstCall.args[0]).deep.equal({
        client: 'sqlite3',
        connection: 'connection_string',
        useNullAsDefault: true,
      })
    })

    it('should have migrated the database', function() {
      const stub = env.stubs.latest
      expect(stub.calledOnce).equal(true)
    })

    it('should have returned the result', function() {
      expect(env.result).equal(env.stubs.result)
    })
  })
})
