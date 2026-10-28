import pg from 'pg';
import { afterAll, describe, expect, it } from 'vitest';
import { ensureDatabase } from '../scripts/ensure-database.js';

// Uses the throwaway PostgreSQL started by tests/global-setup.ts
const conn = { host: 'localhost', port: 54329, user: 'betlink_test', password: 'betlink_test' };
const admin = new pg.Client({ ...conn, database: 'betlink_test' });

afterAll(async () => {
  await admin.query('DROP DATABASE IF EXISTS ensure_db_check');
  await admin.end();
});

const openConnectionsTo = async (db: string) =>
  Number((await admin.query('SELECT count(*) FROM pg_stat_activity WHERE datname = $1', [db])).rows[0].count);

describe('ensureDatabase (db:local helper)', () => {
  it('creates a missing database once, keeps existing data, and leaves no open connections', async () => {
    await admin.connect();
    await admin.query('DROP DATABASE IF EXISTS ensure_db_check');
    const before = await openConnectionsTo('postgres');

    expect(await ensureDatabase(conn, 'ensure_db_check')).toBe(true);

    // Put data in it, then run again: must report "already exists" and not touch the data
    const c = new pg.Client({ ...conn, database: 'ensure_db_check' });
    await c.connect();
    await c.query('CREATE TABLE keep (n int); INSERT INTO keep VALUES (16)');
    await c.end();

    expect(await ensureDatabase(conn, 'ensure_db_check')).toBe(false);
    const c2 = new pg.Client({ ...conn, database: 'ensure_db_check' });
    await c2.connect();
    expect((await c2.query('SELECT n FROM keep')).rows).toEqual([{ n: 16 }]);
    await c2.end();

    // The leaked connection was the original bug: the helper must close its connection every time.
    // Closed backends can take a moment to leave pg_stat_activity, so poll briefly.
    let after = await openConnectionsTo('postgres');
    for (let i = 0; i < 20 && after > before; i++) {
      await new Promise((r) => setTimeout(r, 100));
      after = await openConnectionsTo('postgres');
    }
    expect(after).toBe(before);
  });

  it('refuses unsafe database names', async () => {
    await expect(ensureDatabase(conn, 'x; DROP DATABASE betlink_test')).rejects.toThrow(/Unsafe database name/);
  });
});
