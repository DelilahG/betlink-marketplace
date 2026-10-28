// Spins up a throwaway real PostgreSQL (embedded-postgres) for the test run, then removes it.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import EmbeddedPostgres from 'embedded-postgres';

export default async function setup() {
  const databaseDir = fs.mkdtempSync(path.join(os.tmpdir(), 'betlink-pg-'));
  fs.rmSync(databaseDir, { recursive: true });
  const pg = new EmbeddedPostgres({
    databaseDir, user: 'betlink_test', password: 'betlink_test', port: 54329, persistent: false, onLog: () => {},
  });
  await pg.initialise();
  await pg.start();
  await pg.createDatabase('betlink_test');
  return async () => {
    await pg.stop();
  };
}
