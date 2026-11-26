/**
 * Integration tests run against a real PostgreSQL database (TEST_DATABASE_URL).
 * Before the run, the public schema is dropped and every migration is applied
 * from scratch, which also proves the migrations work on a clean database.
 */
import "dotenv/config";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { createPool } from "../../src/db/client";

export default async function setup() {
  const url = process.env.TEST_DATABASE_URL;
  if (!url) throw new Error("TEST_DATABASE_URL must be set to run integration tests");
  const pool = createPool(url);
  try {
    await pool.query(
      "DROP SCHEMA IF EXISTS public CASCADE; DROP SCHEMA IF EXISTS drizzle CASCADE;",
    );
    await pool.query("CREATE SCHEMA public;");
    await migrate(drizzle(pool), { migrationsFolder: "drizzle" });
  } finally {
    await pool.end();
  }
}
