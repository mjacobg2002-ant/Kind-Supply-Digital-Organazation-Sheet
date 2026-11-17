import { readFile } from 'node:fs/promises';
import pg from 'pg';

let pool;
export function database() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required');
  return pool ??= new pg.Pool({
    connectionString: process.env.DATABASE_URL,
    max: 4,
    connectionTimeoutMillis: 6000,
    idleTimeoutMillis: 10000,
    allowExitOnIdle: true
  });
}

export async function migrate(db) {
  const schema = await readFile(new URL('./schema.sql', import.meta.url), 'utf8');
  if (db.exec) return db.exec(schema);
  return db.query(schema);
}

export async function transaction(db, run) {
  if (db.transaction) return db.transaction(run);
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const result = await run(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
