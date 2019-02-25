module.exports = () => {
  const noop = () => {}
  return {
    trace: noop,
    debug: noop,
    info: noop,
    warn: noop,
    error: noop,
  }
}
