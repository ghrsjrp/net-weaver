import { Pool, PoolConfig } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const poolConfig: PoolConfig = {
  host: process.env.DATABASE_HOST || 'localhost',
  port: parseInt(process.env.DATABASE_PORT || '5432', 10),
  database: process.env.DATABASE_NAME || 'nettopo',
  user: process.env.DATABASE_USER || 'nettopo',
  password: process.env.DATABASE_PASSWORD || 'nettopo',
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
};

export const pool = new Pool(poolConfig);

pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
  process.exit(-1);
});

export async function testConnection(): Promise<boolean> {
  try {
    const client = await pool.connect();
    await client.query('SELECT NOW()');
    client.release();
    console.log('✓ Database connection successful');
    return true;
  } catch (error) {
    console.error('✗ Database connection failed:', error);
    return false;
  }
}

function summarizeParams(params?: any[]) {
  if (!params) return [];
  return params.map((p, idx) => {
    const base = {
      index: idx + 1,
      type:
        p === null
          ? 'null'
          : p instanceof Date
            ? 'Date'
            : Array.isArray(p)
              ? 'Array'
              : typeof p,
    } as any;

    // Avoid logging sensitive values (like SSH passwords). Only log lengths.
    if (typeof p === 'string') return { ...base, length: p.length };
    if (Array.isArray(p)) return { ...base, length: p.length };
    return base;
  });
}

export async function query<T = any>(text: string, params?: any[]): Promise<T[]> {
  try {
    const result = await pool.query(text, params);
    return result.rows as T[];
  } catch (error) {
    console.error('[DB] Query failed:', {
      text,
      params: summarizeParams(params),
    });
    console.error('[DB] Error:', error);
    throw error;
  }
}

export async function queryOne<T = any>(text: string, params?: any[]): Promise<T | null> {
  const rows = await query<T>(text, params);
  return rows[0] as T || null;
}

export default pool;
