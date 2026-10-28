/**
 * Development-only: creates (or promotes) an administrator.
 *   npm run create-admin -- --email you@example.com --name "Your Name"
 * The password is read from the ADMIN_PASSWORD environment variable so it never lands in shell history or code.
 */
import bcrypt from 'bcryptjs';
import { config } from '../src/config.js';
import { pool } from '../src/db.js';
import { runMigrations } from '../src/migrate.js';

if (config.isProd) {
  console.error('Refusing to run in production. Create production admins through a controlled, audited process.');
  process.exit(1);
}

const arg = (name: string) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : undefined;
};
const email = arg('email')?.toLowerCase();
const name = arg('name') ?? 'BetLink Admin';
const password = process.env.ADMIN_PASSWORD;

if (!email || !password || password.length < 12) {
  console.error('Usage: $env:ADMIN_PASSWORD="<at least 12 chars>"; npm run create-admin -- --email you@example.com --name "Name"');
  process.exit(1);
}

await runMigrations(pool, () => {});
const hash = await bcrypt.hash(password, 12);
await pool.query(
  `INSERT INTO users (email, password_hash, full_name, role, verification_status) VALUES ($1, $2, $3, 'admin', 'verified')
   ON CONFLICT ((lower(email))) DO UPDATE SET role = 'admin', password_hash = EXCLUDED.password_hash`,
  [email, hash, name],
);
console.log(`Administrator ready: ${email}`);
await pool.end();
