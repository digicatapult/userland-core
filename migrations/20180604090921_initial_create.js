exports.up = async knex => {
  await knex.schema.createTable('tbl_userlands', def => {
    def.increments('id').primary()
    def.integer('parent_id').nullable()
    def.string('address').notNull()
    def.integer('block_number').notNull()
    def.integer('transaction_gas_limit').notNull()
    def.integer('last_processed_block').notNull()

    def
      .foreign('parent_id')
      .references('id')
      .on('tbl_userlands')

    def.index('address')
  })

  await knex.schema.createTable('tbl_userland_contracts', def => {
    def.increments('id').primary()
    def.integer('userland_id').notNull()
    def.string('address').notNull()
    def.integer('block_number').notNull()

    def
      .foreign('userland_id')
      .references('id')
      .on('tbl_userlands')

    def.unique(['userland_id', 'address'])

    def.index('address')
  })

  await knex.schema.createTable('tbl_userland_contract_code', def => {
    def.increments('id').primary()
    def.integer('userland_contract_id').notNull()
    def.integer('block_number').notNull()
    def.string('value').nullable()

    def
      .foreign('userland_contract_id')
      .references('id')
      .on('tbl_userland_contracts')

    def.unique(['userland_contract_id', 'block_number'])
  })

  await knex.schema.createTable('tbl_userland_contract_balance', def => {
    def.increments('id').primary()
    def.integer('userland_contract_id').notNull()
    def.integer('block_number').notNull()
    def.string('value').nullable()

    def
      .foreign('userland_contract_id')
      .references('id')
      .on('tbl_userland_contracts')

    def.unique(['userland_contract_id', 'block_number'])
  })

  await knex.schema.createTable('tbl_userland_contract_nonce', def => {
    def.increments('id').primary()
    def.integer('userland_contract_id').notNull()
    def.integer('block_number').notNull()
    def.string('value').nullable()

    def
      .foreign('userland_contract_id')
      .references('id')
      .on('tbl_userland_contracts')

    def.unique(['userland_contract_id', 'block_number'])
  })

  await knex.schema.createTable('tbl_userland_contract_state', def => {
    def.increments('id').primary()
    def.integer('userland_contract_id').notNull()
    def.integer('block_number').notNull()
    def.string('state_key').notNull()
    def.string('value').nullable()

    def
      .foreign('userland_contract_id')
      .references('id')
      .on('tbl_userland_contracts')

    // we generally don't want to iterate all state for a contract at a blocknumber
    // instead we want to lookup the latest state for a particular state key
    // hence the order in this key
    def.unique(['userland_contract_id', 'state_key', 'block_number'])
  })
}

exports.down = async knex => {
  await knex.schema.dropTable('tbl_userland_contract_state')
  await knex.schema.dropTable('tbl_userland_contract_code')
  await knex.schema.dropTable('tbl_userland_contract_balance')
  await knex.schema.dropTable('tbl_userland_contract_nonce')
  await knex.schema.dropTable('tbl_userland_contracts')
  await knex.schema.dropTable('tbl_userlands')
}
