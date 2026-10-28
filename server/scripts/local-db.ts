/**
 * Starts a real PostgreSQL server from the `embedded-postgres` npm package, storing data in server/.pgdata.
 * Useful on Windows when you do not want to install PostgreSQL system-wide. Local development only.
 * Keep this terminal open while you work; Ctrl+C stops the database.
 */
import fs from 'node:fs';
import path from 'node:path';
import EmbeddedPostgres from 'embedded-postgres';
import { serverRoot } from '../src/config.js';
import { ensureDatabase } from './ensure-database.js';

const port = Number(process.env.LOCAL_DB_PORT ?? 5433);
const password = process.env.LOCAL_DB_PASSWORD ?? 'betlink_local_dev';
const databaseDir = path.join(serverRoot, '.pgdata');

const server = new EmbeddedPostgres({ databaseDir, user: 'betlink', password, port, persistent: true, onLog: () => {} });

try {
  if (!fs.existsSync(path.join(databaseDir, 'PG_VERSION'))) await server.initialise();
  await server.start();
} catch (err) {
  console.error(
    `Could not start PostgreSQL on port ${port}. Is it already running (e.g. an earlier \`npm run db:local\` window)?\n` +
      'Close that instance, or set LOCAL_DB_PORT to a free port and update DATABASE_URL to match.',
    err ?? '',
  );
  process.exit(1);
}

try {
  const created = await ensureDatabase({ host: 'localhost', port, user: 'betlink', password }, 'betlink');
  if (created) console.log('Created database "betlink".');
} catch (err) {
  console.error('PostgreSQL started, but the "betlink" database could not be checked or created:', err);
  await server.stop().catch(() => {});
  process.exit(1);
}
console.log(`PostgreSQL running. Put this in server/.env:\nDATABASE_URL=postgres://betlink:${password}@localhost:${port}/betlink`);
console.log('Press Ctrl+C to stop the database.');

// On Windows, Ctrl+C reaches PostgreSQL directly too, so it may already be shutting down when we
// call stop(); either way this is a normal shutdown, not an error.
let stopping = false;
const stop = async () => {
  if (stopping) return;
  stopping = true;
  console.log('\nStopping PostgreSQL...');
  await server.stop().catch(() => {});
  console.log('PostgreSQL stopped.');
  process.exit(0);
};
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
process.on('SIGBREAK', stop); // Ctrl+Break / console close on Windows
