import { Pool } from 'pg';
import { env } from './env.js';

if (!env.databaseUrl) {
  throw new Error('DATABASE_URL is not set. Create server/.env before starting the API.');
}

function useSsl(connectionString, nodeEnv) {
  if (nodeEnv === 'production') {
    return true;
  }
  const url = String(connectionString || '').toLowerCase();
  return url.includes('render.com') || url.includes('sslmode=require');
}

export const pool = new Pool({
  connectionString: env.databaseUrl,
  ssl: useSsl(env.databaseUrl, env.nodeEnv) ? { rejectUnauthorized: false } : false,
});
