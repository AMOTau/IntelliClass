import { Pool } from 'pg';
import { env } from './env.js';

if (!env.databaseUrl) {
  throw new Error('DATABASE_URL is not set. Create server/.env before starting the API.');
}

export const pool = new Pool({
  connectionString: env.databaseUrl,
  ssl: env.nodeEnv === 'production' ? { rejectUnauthorized: false } : false,
});
