import pg from "pg";
import { DatabaseSync } from "node:sqlite";
import { config } from "./config.js";
import { localDataDirectory } from "./local-secrets.js";
import { mkdirSync } from "node:fs";
import { join } from "node:path";

/**
 * Production persistence boundary. Demo storage intentionally does not instantiate
 * either adapter, so synthetic fixtures can never silently become production data.
 */
export const database = config.mode === "production"
  ? new pg.Pool({ connectionString: config.databaseUrl, ssl: process.env.PGSSLMODE === "require" ? { rejectUnauthorized: true } : undefined })
  : null;

export const localDatabase = config.mode === "local"
  ? openLocalDatabase()
  : null;

function openLocalDatabase() {
  mkdirSync(localDataDirectory, { recursive: true });
  const db = new DatabaseSync(join(localDataDirectory, "harbor-health.sqlite"), { timeout: 5000 });
  db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;
    CREATE TABLE IF NOT EXISTS accounts (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      full_name TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL CHECK (role IN ('patient', 'donor', 'volunteer')),
      volunteer_code TEXT UNIQUE,
      referred_by TEXT REFERENCES accounts(id) ON DELETE SET NULL,
      created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
      CHECK ((role = 'volunteer') = (volunteer_code IS NOT NULL))
    );
    CREATE TABLE IF NOT EXISTS donor_profiles (
      user_id TEXT PRIMARY KEY REFERENCES accounts(id) ON DELETE CASCADE,
      phone_ciphertext TEXT NOT NULL,
      phone_iv TEXT NOT NULL,
      phone_auth_tag TEXT NOT NULL,
      blood_group TEXT NOT NULL,
      country TEXT NOT NULL,
      state TEXT NOT NULL,
      district TEXT NOT NULL,
      city TEXT NOT NULL,
      available INTEGER NOT NULL DEFAULT 1 CHECK (available IN (0, 1)),
      consent_at TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
      updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
    );
    CREATE INDEX IF NOT EXISTS donor_profiles_matching_idx
      ON donor_profiles (available, blood_group, country, state, district);
    CREATE TABLE IF NOT EXISTS blood_requests (
      id TEXT PRIMARY KEY,
      requester_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,
      blood_group TEXT NOT NULL,
      area TEXT NOT NULL,
      units INTEGER NOT NULL CHECK (units BETWEEN 1 AND 20),
      urgency TEXT NOT NULL CHECK (urgency IN ('Routine', 'Urgent')),
      clinic TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'fulfilled', 'cancelled')),
      created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
      updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
    );
    CREATE INDEX IF NOT EXISTS blood_requests_active_idx
      ON blood_requests (status, urgency, created_at DESC);
    CREATE TABLE IF NOT EXISTS appointments (
      id TEXT PRIMARY KEY,
      patient_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
      patient_name TEXT NOT NULL,
      clinician TEXT NOT NULL,
      type TEXT NOT NULL,
      hospital TEXT NOT NULL,
      hospital_phone TEXT,
      appointment_date TEXT NOT NULL,
      appointment_time TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'requested' CHECK (status IN ('confirmed', 'requested')),
      created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
    );
    CREATE INDEX IF NOT EXISTS appointments_patient_schedule_idx
      ON appointments (patient_id, appointment_date, created_at DESC);
  `);
  return db;
}

let recordBlobContainerPromise: Promise<unknown> | null = null;

export async function getRecordBlobContainer(): Promise<unknown> {
  if (config.mode !== "production" || !config.blobConnectionString) {
    throw new Error("Blob Storage is available only after production storage is configured.");
  }
  if (!recordBlobContainerPromise) {
    recordBlobContainerPromise = import("@azure/storage-blob").then(({ BlobServiceClient }) =>
      BlobServiceClient.fromConnectionString(config.blobConnectionString!).getContainerClient(config.blobContainer)
    );
  }
  return recordBlobContainerPromise;
}

export function assertProductionStorageConfigured(): void {
  if (config.mode === "production" && !config.blobConnectionString) {
    throw new Error("AZURE_STORAGE_CONNECTION_STRING must be configured before production file features are enabled.");
  }
}
