/**
 * This module encapsulates the storage layer of the userland system
 * It therefore contains abstractions of the database including:
 *  * getting whether an account exists in a given userland
 *  * getting account state by userland, account and key
 *  * writing account state by userland, account and key
 *  * committing writes
 *  * reverting writes
 */

const errors = require('./errors')
const mkStorageManager = require('./db')

module.exports = { errors, mkStorageManager }
