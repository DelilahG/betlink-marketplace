import pg from 'pg';

/**
 * Creates `database` on the given server only if it does not exist yet. Uses one short-lived
 * connection to the maintenance database and always closes it, so nothing is left open that could
 * error later when PostgreSQL shuts down. Never drops or modifies an existing database.
 * Returns true if the database was created.
 */
export async function ensureDatabase(
  conn: { host: string; port: number; user: string; password: string },
  database: string,
): Promise<boolean> {
  if (!/^[a-z_][a-z0-9_]*$/.test(database)) throw new Error(`Unsafe database name: ${database}`);
  const client = new pg.Client({ ...conn, database: 'postgres' });
  client.on('error', () => {}); // a server shutdown mid-check must not become an unhandled 'error' event
  await client.connect();
  try {
    const { rowCount } = await client.query('SELECT 1 FROM pg_database WHERE datname = $1', [database]);
    if (rowCount) return false;
    await client.query(`CREATE DATABASE ${database}`); // name validated above; identifiers cannot be bound as parameters
    return true;
  } finally {
    await client.end().catch(() => {});
  }
}
