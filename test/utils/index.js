const util = require('util')
const { it } = require('mocha')
const { expect } = require('chai')

const wrapCall = (env, fn) => {
  const wrapped = util.promisify(fn)
  return async (...args) => {
    try {
      env.res = await wrapped(...args)
    } catch (err) {
      env.err = err
    }
  }
}

const assertNoError = env => {
  it('should not error', function() {
    expect(env.err).to.equal(undefined)
  })
}

const mkLogger = () => {
  const noop = () => {}
  return {
    trace: noop,
    debug: noop,
    info: noop,
    warn: noop,
    error: noop,
  }
}

module.exports = {
  wrapCall,
  assertNoError,
  mkLogger,
}
