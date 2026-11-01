import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { config } from "./config.js";
import { database } from "./storage.js";

async function migrate() {
  if (config.mode !== "production" || !database) {
    throw new Error("Database migrations require APP_MODE=production and DATABASE_URL.");
  }

  const migrationDirectory = join(process.cwd(), "migrations");
  const files = (await readdir(migrationDirectory)).filter((file) => /^\d+_[\w-]+\.sql$/.test(file)).sort();
  const client = await database.connect();
  try {
    await client.query("SELECT pg_advisory_lock(481902733)");
    await client.query("CREATE TABLE IF NOT EXISTS schema_migrations (name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())");
    for (const file of files) {
      const applied = await client.query("SELECT 1 FROM schema_migrations WHERE name = $1", [file]);
      if (applied.rowCount) continue;
      const sql = await readFile(join(migrationDirectory, file), "utf8");
      await client.query("BEGIN");
      try {
        await client.query(sql);
        await client.query("INSERT INTO schema_migrations (name) VALUES ($1)", [file]);
        await client.query("COMMIT");
        console.log(`Applied migration ${file}`);
      } catch (reason) {
        await client.query("ROLLBACK");
        throw reason;
      }
    }
  } finally {
    await client.query("SELECT pg_advisory_unlock(481902733)");
    client.release();
    await database.end();
  }
}

void migrate().catch((reason: unknown) => {
  console.error("Database migration failed:", reason instanceof Error ? reason.message : reason);
  process.exitCode = 1;
});