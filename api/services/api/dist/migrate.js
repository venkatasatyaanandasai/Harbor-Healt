"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const promises_1 = require("node:fs/promises");
const node_path_1 = require("node:path");
const config_js_1 = require("./config.js");
const storage_js_1 = require("./storage.js");
async function migrate() {
    if (config_js_1.config.mode !== "production" || !storage_js_1.database) {
        throw new Error("Database migrations require APP_MODE=production and DATABASE_URL.");
    }
    const migrationDirectory = (0, node_path_1.join)(process.cwd(), "migrations");
    const files = (await (0, promises_1.readdir)(migrationDirectory)).filter((file) => /^\d+_[\w-]+\.sql$/.test(file)).sort();
    const client = await storage_js_1.database.connect();
    try {
        await client.query("SELECT pg_advisory_lock(481902733)");
        await client.query("CREATE TABLE IF NOT EXISTS schema_migrations (name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())");
        for (const file of files) {
            const applied = await client.query("SELECT 1 FROM schema_migrations WHERE name = $1", [file]);
            if (applied.rowCount)
                continue;
            const sql = await (0, promises_1.readFile)((0, node_path_1.join)(migrationDirectory, file), "utf8");
            await client.query("BEGIN");
            try {
                await client.query(sql);
                await client.query("INSERT INTO schema_migrations (name) VALUES ($1)", [file]);
                await client.query("COMMIT");
                console.log(`Applied migration ${file}`);
            }
            catch (reason) {
                await client.query("ROLLBACK");
                throw reason;
            }
        }
    }
    finally {
        await client.query("SELECT pg_advisory_unlock(481902733)");
        client.release();
        await storage_js_1.database.end();
    }
}
void migrate().catch((reason) => {
    console.error("Database migration failed:", reason instanceof Error ? reason.message : reason);
    process.exitCode = 1;
});
