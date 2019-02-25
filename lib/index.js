const EventEmitter = require('events')

const initializeDb = require('./db')
const { mkStorageManager } = require('./StorageManager')
const mkBlockRunner = require('./blockRunner')
const mkBlockWatcher = require('./blockWatcher')

const forwardEvents = (source, target, eventList) => {
  for (const event of eventList) {
    source.on(event, obj => {
      target.emit(event, obj)
    })
  }
}

const startUserland = async ({
  web3Provider,
  db = null,
  clientType = null,
  connectionString = null,
  logger,
  options: { confirmationDepth = 15 } = {},
}) => {
  if (db === null) {
    db = await initializeDb({ clientType, connectionString })
  }

  const context = new EventEmitter()

  // build the storage manager
  const storageManager = await mkStorageManager({ db, logger })

  // build the blockRunner
  const blockRunner = mkBlockRunner({ storageManager, web3Provider, logger })
  forwardEvents(blockRunner, context, [
    'userlandCall',
    'runTransaction',
    'runCall',
    'step',
  ])

  // build the blockWatcher
  const blockWatcher = mkBlockWatcher({
    web3Provider,
    logger,
    onBlock: blockRunner.runBlock,
    fromBlock: await storageManager.getLastProcessedBlockNumber(),
    confirmationDepth,
  })
  forwardEvents(blockWatcher, context, [
    'startProcessBlock',
    'finishProcessBlock',
  ])

  Object.assign(context, {
    runCall: blockRunner.runCall,
    stop: timeout => blockWatcher.stop({ timeout }),
  })
  return context
}

module.exports = {
  initializeDb,
  startUserland,
}
