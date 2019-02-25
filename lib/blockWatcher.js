const Web3 = require('web3')
const delay = require('delay')

const EventEmitter = require('events')
const { promisify } = require('util')

const errorWarnLimit = 1000

module.exports = ({
  logger,
  web3Provider,
  onBlock,
  fromBlock,
  confirmationDepth,
  delayMs = 500,
}) => {
  const web3 = new Web3(web3Provider)
  const getBlockNumber = promisify((...args) =>
    web3.eth.getBlockNumber(...args)
  )

  let stopping = false
  let stopped = false
  let processingBlockNumber = fromBlock
  const handle = (async () => {
    let errorCount = 0
    while (!stopping) {
      let shouldProcessBlock = false
      try {
        // update the max known block number
        const currentBlockNumber = await getBlockNumber()
        const maxBlockToProcess = currentBlockNumber - confirmationDepth

        if (processingBlockNumber > maxBlockToProcess) {
          await delay(delayMs)
        } else {
          shouldProcessBlock = true
        }
      } catch (err) {
        logger.trace(`Error fetching block transactions: ${err}`)
        errorCount++
        if (errorCount >= errorWarnLimit) {
          logger.warn(
            `Multiple errors encountered fetching block transactions. Last error was: ${err}`
          )
          errorCount = 0
        }

        await delay(this.delayMs)
      }

      if (shouldProcessBlock) {
        errorCount = 0
        context.emit('startProcessBlock', {
          blockNumber: processingBlockNumber,
        })
        await onBlock(processingBlockNumber)
        context.emit('finishProcessBlock', {
          blockNumber: processingBlockNumber,
        })
        processingBlockNumber++
      }
    }
    stopped = true
  })()

  const context = new EventEmitter()
  Object.assign(context, {
    stop: async ({ timeout }) => {
      stopping = true
      await Promise.race([delay(timeout), handle])
      if (!stopped) {
        logger.warn(`Block Watcher failed to stop after ${timeout}ms`)
      }
    },
  })

  return context
}
