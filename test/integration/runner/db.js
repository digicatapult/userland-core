const populateDb = async (db, { userlands = [] }) => {
  if (userlands.length > 0) {
    const userlandRows = [],
      userlandContractRows = [],
      codeRows = [],
      stateRows = [],
      balanceRows = [],
      nonceRows = []

    for (let i = 0; i < userlands.length; i++) {
      const userland = userlands[i]

      userlandRows.push({
        parent_id: userland.parent || null,
        address: userland.address,
        transaction_gas_limit: userland.transactionGasLimit || 10000000,
        last_processed_block: userland.blockNumber || 0,
        block_number: userland.blockNumber || 0,
      })

      userlandContractRows.push({
        userland_id: i + 1,
        address: userland.address,
        block_number: userland.blockNumber || 0,
      })

      codeRows.push({
        userland_contract_id: i + 1,
        block_number: userland.blockNumber || 0,
        value: '5880543314600a5750005b80553660008181823780f05000',
      })

      stateRows.push({
        userland_contract_id: i + 1,
        block_number: userland.blockNumber || 0,
        state_key:
          '0000000000000000000000000000000000000000000000000000000000000000',
        value: userland.owner,
      })

      balanceRows.push({
        userland_contract_id: i + 1,
        block_number: userland.blockNumber || 0,
        value: '00',
      })

      nonceRows.push({
        userland_contract_id: i + 1,
        block_number: userland.blockNumber || 0,
        value: '01',
      })
    }

    await db('tbl_userlands').insert(userlandRows)
    await db('tbl_userland_contracts').insert(userlandContractRows)

    await Promise.all([
      db('tbl_userland_contract_code').insert(codeRows),
      db('tbl_userland_contract_state').insert(stateRows),
      db('tbl_userland_contract_balance').insert(balanceRows),
      db('tbl_userland_contract_nonce').insert(nonceRows),
    ])
  }
}

const readDb = async db => {
  const [u, uc, ucs, ucc, ucb, ucn] = await Promise.all([
    await db('tbl_userlands')
      .select()
      .orderBy('id'),
    await db('tbl_userland_contracts')
      .select()
      .orderBy(['userland_id', 'id']),
    await db('tbl_userland_contract_state')
      .select()
      .orderBy(['userland_contract_id', 'state_key', 'block_number']),
    await db('tbl_userland_contract_code')
      .select()
      .orderBy(['userland_contract_id', 'block_number']),
    await db('tbl_userland_contract_balance')
      .select()
      .orderBy(['userland_contract_id', 'block_number']),
    await db('tbl_userland_contract_nonce')
      .select()
      .orderBy(['userland_contract_id', 'block_number']),
  ])

  const result = {}
  let u_index = 0,
    uc_index = 0,
    ucs_index = 0,
    ucc_index = 0,
    ucb_index = 0,
    ucn_index = 0
  for (; u_index < u.length; u_index++) {
    const userland = u[u_index]
    const contracts = {}
    for (
      ;
      uc_index < uc.length && uc[uc_index].userland_id === userland.id;
      uc_index++
    ) {
      const userlandContract = uc[uc_index]
      const result = {
        address: userlandContract.address,
        blockNumber: userlandContract.block_number,
      }
      const state = {}
      for (
        ;
        ucs_index < ucs.length &&
        ucs[ucs_index].userland_contract_id === userlandContract.id;
        ucs_index++
      ) {
        const stateRow = ucs[ucs_index]
        state[stateRow.state_key] = stateRow.value
      }
      result.state = state

      for (
        ;
        ucc_index < ucc.length &&
        ucc[ucc_index].userland_contract_id === userlandContract.id;
        ucc_index++
      ) {
        result.code = ucc[ucc_index].value
      }

      for (
        ;
        ucb_index < ucb.length &&
        ucb[ucb_index].userland_contract_id === userlandContract.id;
        ucb_index++
      ) {
        result.balance = ucb[ucb_index].value
      }

      for (
        ;
        ucn_index < ucn.length &&
        ucn[ucn_index].userland_contract_id === userlandContract.id;
        ucn_index++
      ) {
        result.nonce = ucn[ucn_index].value
      }

      contracts[userlandContract.address] = result
    }
    result[userland.address] = {
      address: userland.address,
      blockNumber: userland.block_number,
      lastProcessedBlock: userland.last_processed_block,
      transactionGasLimit: userland.transaction_gas_limit,
      contracts,
    }
  }

  return result
}

module.exports = { populateDb, readDb }
