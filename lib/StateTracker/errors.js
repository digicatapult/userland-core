class InvalidCheckpointError extends Error {
  constructor(message) {
    super(message)
    this.name = 'InvalidCheckpointError'
  }
}

module.exports = {
  InvalidCheckpointError,
}
