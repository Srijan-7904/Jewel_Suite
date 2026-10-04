import DatabaseConstructor, { Database as DatabaseType } from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { config } from '../../config/env.js';

let dbInstance: DatabaseType | null = null;

/**
 * Initializes and returns the SQLite database connection singleton.
 */
export function getDb(): DatabaseType {
  if (dbInstance) {
    return dbInstance;
  }

  const dbPath = config.dbPath;
  const dbDir = path.dirname(dbPath);

  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }

  dbInstance = new DatabaseConstructor(dbPath, {
    // verbose: config.isDev ? console.log : undefined
  });

  // Optimize SQLite for high-reliability offline POS
  dbInstance.pragma('journal_mode = WAL');
  dbInstance.pragma('foreign_keys = ON');
  dbInstance.pragma('busy_timeout = 5000');
  dbInstance.pragma('synchronous = NORMAL');

  return dbInstance;
}

/**
 * Sets a custom database instance (used for testing or in-memory DB).
 */
export function setDb(customDb: DatabaseType | null): void {
  dbInstance = customDb;
}

/**
 * Executes a function within an atomic SQLite transaction.
 * Automatically rolls back on exception and commits on success.
 */
export function withTransaction<T>(fn: (db: DatabaseType) => T): T {
  const db = getDb();
  const tx = db.transaction(fn);
  return tx(db);
}

/**
 * Safely closes the database connection.
 */
export function closeDb(): void {
  if (dbInstance && dbInstance.open) {
    dbInstance.close();
    dbInstance = null;
  }
}
