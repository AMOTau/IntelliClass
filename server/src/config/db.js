import { Pool } from 'pg';
import { env } from './env.js';

if (!env.databaseUrl) {
  throw new Error('DATABASE_URL is not set. Create server/.env before starting the API.');
}

function useSsl(connectionString, nodeEnv) {
  const url = String(connectionString || '').toLowerCase();
  if (url.includes('localhost') || url.includes('127.0.0.1')) {
    return false;
  }
  if (nodeEnv === 'production') {
    return true;
  }
  return url.includes('render.com') || url.includes('sslmode=require');
}

export const pool = new Pool({
  connectionString: env.databaseUrl,
  ssl: useSsl(env.databaseUrl, env.nodeEnv) ? { rejectUnauthorized: false } : false,
});
