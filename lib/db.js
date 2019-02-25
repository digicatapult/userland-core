const knex = require('knex')

module.exports = async ({
  clientType: client,
  connectionString: connection,
}) => {
  if (typeof connection !== 'string' || typeof client !== 'string') {
    throw new Error(
      `Invalid parameters for database connection. Client type ${client} with connection string ${connection}`
    )
  }

  const additionalOptions =
    client === 'sqlite3'
      ? {
          useNullAsDefault: true,
        }
      : {}

  const db = knex({
    client,
    connection,
    ...additionalOptions,
  })
  await db.migrate.latest()
  return db
}
