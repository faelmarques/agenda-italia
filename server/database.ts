import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { config } from "./config.js";

export type AppDatabase = Database.Database;

const migrations = [
  `
    CREATE TABLE users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE COLLATE NOCASE,
      password_hash TEXT NOT NULL,
      professional_title TEXT,
      registration TEXT,
      clinic_name TEXT NOT NULL DEFAULT 'Agenda Italia',
      default_duration_minutes INTEGER NOT NULL DEFAULT 50 CHECK (default_duration_minutes BETWEEN 15 AND 240),
      reminder_hours INTEGER NOT NULL DEFAULT 24 CHECK (reminder_hours BETWEEN 1 AND 168),
      timezone TEXT NOT NULL DEFAULT 'America/Sao_Paulo',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE patients (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      birth_date TEXT,
      phone TEXT,
      email TEXT COLLATE NOCASE,
      notes TEXT,
      active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
      notification_consent INTEGER NOT NULL DEFAULT 0 CHECK (notification_consent IN (0, 1)),
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE appointments (
      id TEXT PRIMARY KEY,
      patient_id TEXT NOT NULL REFERENCES patients(id) ON DELETE RESTRICT,
      starts_at TEXT NOT NULL,
      ends_at TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'Sessão',
      modality TEXT NOT NULL CHECK (modality IN ('presencial', 'video')),
      status TEXT NOT NULL DEFAULT 'scheduled'
        CHECK (status IN ('scheduled', 'confirmed', 'cancelled', 'completed', 'no_show')),
      location TEXT,
      private_notes TEXT,
      confirmation_sent_at TEXT,
      reminder_sent_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      CHECK (datetime(ends_at) > datetime(starts_at))
    );

    CREATE INDEX idx_appointments_starts_at ON appointments(starts_at);
    CREATE INDEX idx_appointments_patient_id ON appointments(patient_id);
    CREATE INDEX idx_appointments_status ON appointments(status);
    CREATE INDEX idx_patients_name ON patients(name);
  `,
];

export const createDatabase = (filename: string = config.databasePath): AppDatabase => {
  if (filename !== ":memory:") {
    fs.mkdirSync(path.dirname(filename), { recursive: true });
  }

  const database = new Database(filename);
  database.pragma("foreign_keys = ON");
  database.pragma("busy_timeout = 5000");
  if (filename !== ":memory:") {
    database.pragma("journal_mode = WAL");
  }

  migrate(database);
  return database;
};

const migrate = (database: AppDatabase): void => {
  const currentVersion = database.pragma("user_version", { simple: true }) as number;

  for (let version = currentVersion; version < migrations.length; version += 1) {
    const migration = migrations[version];
    if (!migration) continue;

    database.transaction(() => {
      database.exec(migration);
      database.pragma(`user_version = ${version + 1}`);
    })();
  }
};

export const nowIso = (): string => new Date().toISOString();
