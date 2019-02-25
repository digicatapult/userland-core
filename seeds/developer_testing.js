exports.seed = async knex => {
  // Deletes ALL existing entries
  await knex('tbl_userland_contract_state').del()
  await knex('tbl_userland_contracts').del()
  await knex('tbl_userlands').del()

  await knex.raw('ALTER SEQUENCE tbl_userlands_id_seq RESTART WITH 1')
  await knex.raw('ALTER SEQUENCE tbl_userland_contracts_id_seq RESTART WITH 1')
  await knex.raw(
    'ALTER SEQUENCE tbl_userland_contract_state_id_seq RESTART WITH 1'
  )

  await knex('tbl_userlands').insert({
    address: '0x1111111111111111111111111111111111111111',
    transaction_gas_limit: 10000000,
    last_processed_block: 0,
    parent_id: null,
  })

  await knex('tbl_userland_contracts').insert({
    address: '0x1111111111111111111111111111111111111111',
    userland_id: 1,
  })
}
