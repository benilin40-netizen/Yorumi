import { drizzle } from 'drizzle-orm/node-postgres';
import pkg from 'pg';
import * as schema from './schema.js';

const { Pool } = pkg;

const connectionString = process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/yorumi';

const pool = new Pool({
  connectionString,
  ssl: connectionString.includes('localhost') ? false : { rejectUnauthorized: false },
});

export const db = drizzle(pool, { schema });

export async function testDatabaseConnection(): Promise<boolean> {
  try {
    const client = await pool.connect();
    await client.query('SELECT 1');
    client.release();
    return true;
  } catch (err) {
    console.error('Database connection test failed:', err);
    return false;
  }
}
