import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { Database as DatabaseType } from 'better-sqlite3';
import { getDb } from '../connection/db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface MigrationResult {
  appliedCount: number;
  appliedMigrations: string[];
}

/**
 * Runs all pending migrations against the SQLite database.
 */
export function runMigrations(customDb?: DatabaseType): MigrationResult {
  const db = customDb || getDb();

  // 1. Ensure migrations tracking table exists
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      migration_name TEXT UNIQUE NOT NULL,
      applied_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  // 2. Fetch already applied migrations
  const appliedRows = db.prepare('SELECT migration_name FROM schema_migrations').all() as { migration_name: string }[];
  const appliedSet = new Set(appliedRows.map((r) => r.migration_name));

  // 3. Discover SQL migration files
  // In development/build, migrations are in the same folder as migrator
  const migrationsDir = __dirname;
  const files = fs.readdirSync(migrationsDir)
    .filter((file) => file.endsWith('.sql'))
    .sort();

  const newlyApplied: string[] = [];

  for (const file of files) {
    if (appliedSet.has(file)) {
      continue;
    }

    const filePath = path.join(migrationsDir, file);
    const sql = fs.readFileSync(filePath, 'utf-8');

    // Run migration in an atomic transaction
    const executeMigration = db.transaction(() => {
      db.exec(sql);
      db.prepare('INSERT INTO schema_migrations (migration_name, applied_at) VALUES (?, datetime(\'now\'))').run(file);
    });

    executeMigration();
    newlyApplied.push(file);
    console.log(`[Database] Applied migration: ${file}`);
  }

  return {
    appliedCount: newlyApplied.length,
    appliedMigrations: newlyApplied,
  };
}
