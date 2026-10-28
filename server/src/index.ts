import { createApp } from './app.js';
import { config } from './config.js';
import { pool } from './db.js';
import { runMigrations } from './migrate.js';

if (!config.databaseUrl) {
  console.error('DATABASE_URL is not set. Copy server/.env.example to server/.env first.');
  process.exit(1);
}

await runMigrations(pool);
createApp().listen(config.port, () => console.log(`BetLink API listening on http://localhost:${config.port}`));
