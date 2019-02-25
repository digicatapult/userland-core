const { VmError, ERROR } = require('ethereumjs-vm/dist/exceptions')

class InvalidBlockNumberError extends Error {
  constructor(message) {
    super(message)
    this.name = 'InvalidBlockNumberError'
  }
}

class InvalidOperationError extends Error {
  constructor(message) {
    super(message)
    this.name = 'InvalidWriteOperationError'
  }
}

// In order for write errors to be interpreted as
// being invalid correctly we need to implement an
// error compatible with the ethereumjs-vm error class
class InvalidWriteError extends VmError {
  constructor() {
    super(ERROR.STATIC_STATE_CHANGE)
    this.name = 'InvalidWriteError'
  }
}

module.exports = {
  InvalidBlockNumberError,
  InvalidOperationError,
  InvalidWriteError,
}
