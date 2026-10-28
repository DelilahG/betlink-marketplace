import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

const here = path.dirname(fileURLToPath(import.meta.url));
// Works from both src/ (tsx) and dist/src/ (compiled)
export const serverRoot =
  path.basename(path.dirname(here)) === 'dist' ? path.resolve(here, '../..') : path.resolve(here, '..');

dotenv.config({ path: path.join(serverRoot, '.env'), quiet: true });

const env = process.env;
export const config = {
  env: env.NODE_ENV ?? 'development',
  isProd: env.NODE_ENV === 'production',
  isTest: env.NODE_ENV === 'test',
  port: Number(env.PORT ?? 4000),
  databaseUrl: env.DATABASE_URL ?? '',
  clientOrigin: env.CLIENT_ORIGIN ?? 'http://localhost:5173',
  sessionDays: Number(env.SESSION_DAYS ?? 14),
  uploadDir: env.UPLOAD_DIR || path.join(serverRoot, 'uploads'),
  migrationsDir: path.join(serverRoot, 'migrations'),
  clientDist: path.resolve(serverRoot, '../client/dist'),
};
