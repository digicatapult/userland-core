class TransactionInProgressError extends Error {
  constructor(message) {
    super(message)
    this.name = 'TransactionInProgressError'
  }
}

class TransactionNotStartedError extends Error {
  constructor(message) {
    super(message)
    this.name = 'TransactionNotStartedError'
  }
}
class InvalidTransactionError extends Error {
  constructor(message) {
    super(message)
    this.name = 'InvalidTransactionError'
  }
}

class NoConfiguredUserlandsError extends Error {
  constructor(message) {
    super(message)
    this.name = 'NoConfiguredUserlandsError'
  }
}

class InvalidUserlandError extends Error {
  constructor(message) {
    super(message)
    this.name = 'InvalidUserlandError'
  }
}

class InvalidUserlandContractError extends Error {
  constructor(message) {
    super(message)
    this.name = 'InvalidUserlandContractError'
  }
}

module.exports = {
  TransactionInProgressError,
  TransactionNotStartedError,
  InvalidTransactionError,
  NoConfiguredUserlandsError,
  InvalidUserlandError,
  InvalidUserlandContractError,
}
