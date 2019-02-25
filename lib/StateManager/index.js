/**
 * This folder exports ethereumjs-vm stateManager factory implementations along
 * with a collection of error classes that can be thrown
 *  mkExternalStateManager: a read only web3 backed store
 *  mkLayeredStateManager: a bi-layered stateManager based on a read only
 *    stateManager base and a read/write stateTracker state
 *  errors: object containing classes InvalidBlockNumberError and InvalidWriteOperationError
 *
 * The design principle behind these modules is to create a layer on top of our state management
 * that implements the required methods for state manager. The externalStateManager acts as a thin
 * layer on top of a web3 client. This is implemented in this way as it's a fairly natural representation
 * against the web3 API. The layeredStateManager then allows a write layer to be build on top of this
 * with storage backed by a stateTracker. The layered stateManager guarantees that writes can only be
 * applied to accounts in the current layer and that reads are correctly propagated down. These modules do
 * not implement checkpoint functionality which is delegated to the stateTracker.
 */

const mkWeb3StateManager = require('./web3StateManager')
const mkWritableStateManager = require('./writableStateManager')
const mkDbStateManager = require('./dbStateManager')
const mkUserlandStateManager = require('./userlandStateManager')
const errors = require('./errors')

module.exports = {
  mkWeb3StateManager,
  mkWritableStateManager,
  mkDbStateManager,
  mkUserlandStateManager,
  errors,
}
