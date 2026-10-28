/**
 * Starts a real PostgreSQL server from the `embedded-postgres` npm package, storing data in server/.pgdata.
 * Useful on Windows when you do not want to install PostgreSQL system-wide. Local development only.
 * Keep this terminal open while you work; Ctrl+C stops the database.
 */
import fs from 'node:fs';
import path from 'node:path';
import EmbeddedPostgres from 'embedded-postgres';
import { serverRoot } from '../src/config.js';

const port = Number(process.env.LOCAL_DB_PORT ?? 5433);
const password = process.env.LOCAL_DB_PASSWORD ?? 'betlink_local_dev';
const databaseDir = path.join(serverRoot, '.pgdata');

const pg = new EmbeddedPostgres({ databaseDir, user: 'betlink', password, port, persistent: true, onLog: () => {} });

if (!fs.existsSync(path.join(databaseDir, 'PG_VERSION'))) await pg.initialise();
await pg.start();
try {
  await pg.createDatabase('betlink');
} catch {
  /* already exists */
}
console.log(`PostgreSQL running. Put this in server/.env:\nDATABASE_URL=postgres://betlink:${password}@localhost:${port}/betlink`);

const stop = async () => {
  await pg.stop();
  process.exit(0);
};
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
