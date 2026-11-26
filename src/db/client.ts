import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

export type Database = NodePgDatabase<typeof schema>;

/** Creates a pooled connection. Hosted Postgres (e.g. Neon) requires TLS; local Postgres usually does not. */
export function createPool(connectionString: string): Pool {
  const needsSsl = /sslmode=require|neon\.tech/.test(connectionString);
  return new Pool({
    connectionString,
    max: Number(process.env.DATABASE_POOL_MAX ?? 5),
    ssl: needsSsl ? { rejectUnauthorized: true } : undefined,
  });
}

const globalForDb = globalThis as unknown as { pool?: Pool; db?: Database };

function getDatabase(): Database {
  if (!globalForDb.db) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("DATABASE_URL is not set");
    globalForDb.pool = createPool(url);
    globalForDb.db = drizzle(globalForDb.pool, { schema });
  }
  return globalForDb.db;
}

/**
 * Lazily-initialised shared database handle. Reused across hot reloads in
 * development so we do not leak connection pools.
 */
export const db: Database = new Proxy({} as Database, {
  get(_target, prop) {
    const real = getDatabase();
    const value = Reflect.get(real, prop, real);
    return typeof value === "function" ? value.bind(real) : value;
  },
});
