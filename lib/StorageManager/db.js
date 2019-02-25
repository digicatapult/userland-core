const {
  TransactionInProgressError,
  TransactionNotStartedError,
  InvalidTransactionError,
  NoConfiguredUserlandsError,
  InvalidUserlandError,
  InvalidUserlandContractError,
} = require('./errors')

module.exports = ({ db }) => {
  let state = null
  const withTransaction = (() => {
    return writeFn => {
      return async (symbol, ...args) => {
        if (state === null) {
          throw new TransactionNotStartedError()
        } else if (state.symbol !== symbol) {
          throw new InvalidTransactionError()
        }

        return await writeFn(state)(...args)
      }
    }
  })()

  const getFn = (table, filterBuilder = q => q) => async (
    blockNumber,
    userland,
    account,
    ...filterArgs
  ) => {
    const dbRes = await filterBuilder(
      db(`${table} AS s`)
        .select('s.value AS result')
        .innerJoin(
          'tbl_userland_contracts AS uc',
          's.userland_contract_id',
          'uc.id'
        )
        .innerJoin('tbl_userlands AS u', 'uc.userland_id', '=', 'u.id')
        .where('u.address', userland)
        .where('uc.address', account)
        .where('s.block_number', '<=', blockNumber),
      ...filterArgs
    )
      .orderBy('s.block_number', 'desc')
      .limit(1)

    return dbRes.length !== 0 ? dbRes[0].result : null
  }

  const setFn = (
    table,
    fieldBuilder = () => {
      return {}
    }
  ) =>
    withTransaction(
      ({ trx, blockNumber }) => async (userland, account, ...setArgs) => {
        const userlandContractQ = await db('tbl_userland_contracts AS uc')
          .transacting(trx)
          .select('uc.id AS id')
          .innerJoin('tbl_userlands AS u', 'u.id', '=', 'uc.userland_id')
          .where('uc.address', account)
          .where('u.address', userland)

        if (userlandContractQ.length !== 1) {
          throw new InvalidUserlandContractError()
        } else {
          await db(table)
            .transacting(trx)
            .insert({
              userland_contract_id: userlandContractQ[0].id,
              block_number: blockNumber,
              value: setArgs[setArgs.length - 1],
              ...fieldBuilder(...setArgs),
            })
        }
      }
    )

  const assertAccount = async (trx, blockNumber, userland, account) => {
    if (
      (await db('tbl_userlands AS u')
        .transacting(trx)
        .select('uc.id')
        .innerJoin(
          'tbl_userland_contracts AS uc',
          'u.id',
          '=',
          'uc.userland_id'
        )
        .where('u.address', userland)
        .where('uc.address', account)).length === 0
    ) {
      const userlandQ = await db('tbl_userlands')
        .transacting(trx)
        .select(['id'])
        .where('address', userland)

      if (userlandQ.length !== 1) {
        throw new InvalidUserlandError()
      } else {
        await db('tbl_userland_contracts')
          .transacting(trx)
          .insert({
            userland_id: userlandQ[0].id,
            address: account,
            block_number: blockNumber,
          })
      }
    }
  }

  const sm = {
    accountExists: async (blockNumber, userland, account) => {
      return (
        (await db('tbl_userlands AS u')
          .innerJoin(
            'tbl_userland_contracts AS uc',
            'uc.userland_id',
            '=',
            'u.id'
          )
          .where('u.address', userland)
          .where('uc.address', account)
          .where('uc.block_number', '<=', blockNumber)
          .limit(1)).length !== 0
      )
    },
    getAccountState: getFn('tbl_userland_contract_state', (q, key) =>
      q.where('s.state_key', key)
    ),
    getAccountBalance: getFn('tbl_userland_contract_balance'),
    getAccountCode: getFn('tbl_userland_contract_code'),
    getAccountNonce: getFn('tbl_userland_contract_nonce'),
    setAccountState: setFn('tbl_userland_contract_state', key => {
      return { state_key: key }
    }),
    setAccountBalance: setFn('tbl_userland_contract_balance'),
    setAccountCode: setFn('tbl_userland_contract_code'),
    setAccountNonce: setFn('tbl_userland_contract_nonce'),
    clearAccountState: withTransaction(
      ({ trx, blockNumber }) => async (userland, account) => {
        await assertAccount(trx, blockNumber, userland, account)

        const stateKeysQ = await db('tbl_userland_contract_state AS ucs')
          .transacting(trx)
          .select([
            'uc.id AS userland_contract_id',
            'ucs.state_key AS state_key',
          ])
          .innerJoin(
            'tbl_userland_contracts AS uc',
            'ucs.userland_contract_id',
            '=',
            'uc.id'
          )
          .innerJoin('tbl_userlands AS u', 'u.id', '=', 'uc.userland_id')
          .where('uc.address', account)
          .where('u.address', userland)

        if (stateKeysQ.length !== 0) {
          await db('tbl_userland_contract_state')
            .transacting(trx)
            .insert(
              stateKeysQ.map(({ userland_contract_id, state_key }) => {
                return {
                  userland_contract_id,
                  state_key,
                  block_number: blockNumber,
                  value: null,
                }
              })
            )
        }
      }
    ),
    startTransaction: async blockNumber => {
      if (state !== null) throw new TransactionInProgressError()

      let txStartResolve = null
      const txStartPromise = new Promise(resolve => {
        txStartResolve = resolve
      })

      db.transaction(async trx => {
        const statePromise = new Promise((resolve, reject) => {
          state = {
            trx,
            blockNumber,
            resolve,
            reject,
            symbol: Symbol(),
          }
        })
        txStartResolve()
        await statePromise
        state = null
      })

      await txStartPromise
      return state.symbol
    },
    commit: withTransaction(({ trx, resolve, blockNumber }) => async () => {
      try {
        await db('tbl_userlands')
          .transacting(trx)
          .update({ last_processed_block: blockNumber })

        await trx.commit()
        resolve()
      } catch (err) {
        await sm.revert(state.symbol)
      }
    }),
    revert: withTransaction(({ trx, resolve }) => async () => {
      try {
        await trx.rollback()
        resolve()
      } catch (err) {
        resolve()
      }
    }),
    getLastProcessedBlockNumber: async () => {
      const dbRes = await db('tbl_userlands').min({
        last_processed_block: 'last_processed_block',
      })
      if (dbRes.length !== 1) throw new NoConfiguredUserlandsError()
      return dbRes[0].last_processed_block
    },
    getUserland: async userland => {
      const dbRes = await db('tbl_userlands')
        .select([
          'address AS address',
          'transaction_gas_limit AS transactionGasLimit',
          'last_processed_block AS lastProcessedBlock',
        ])
        .where({ address: userland })

      if (dbRes.length !== 1) throw new InvalidUserlandError()
      return dbRes[0]
    },
    getUserlandChildren: async (blockNumber, userland) => {
      const childUserlands = await db('tbl_userlands AS u1')
        .select(['u1.address AS address'])
        .leftJoin('tbl_userlands AS u2', 'u1.parent_id', '=', 'u2.id')
        .where({ 'u2.address': userland })
        .where('u1.block_number', '<=', blockNumber)

      return childUserlands.map(({ address }) => address)
    },
  }

  return sm
}
