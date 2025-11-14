import dbConfig from './db-config.js';
import { createPool, Pool, PoolOptions } from 'mysql2/promise';

let pool: Pool | undefined = undefined;

export async function initializePool(): Promise<void> {
  if (pool) {
    return;
  }

  const options: PoolOptions = {
    host: dbConfig.host,
    port: dbConfig.port,
    user: dbConfig.appUser,
    password: dbConfig.appPassword,
    database: dbConfig.dbName,
    waitForConnections: true,
    connectionLimit: 4,
    queueLimit: 0,
  };

  pool = createPool(options);
  if (!pool) {
    throw new Error('Failed to initialize database pool');
  }
  console.log('Database pool initialized');
}

export function getPool(): Pool {
  if (!pool) {
    throw new Error('Database pool is not initialized');
  }
  return pool;
}
