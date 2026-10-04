import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';

// Load .env if present
dotenv.config();

const NODE_ENV = process.env.NODE_ENV || 'development';
const isDev = NODE_ENV === 'development';

// Determine Database Path:
// In Dev: ./data/jewel-suite.db (relative to project root)
// In Prod: %LOCALAPPDATA%/JewelSuite/data/jewel-suite.db on Windows
function resolveDbPath(): string {
  if (process.env.DB_FILE_PATH) {
    return path.resolve(process.env.DB_FILE_PATH);
  }

  if (isDev) {
    // Project root is 2 levels up from backend/src/config
    const rootDataDir = path.resolve(process.cwd(), '../data');
    if (fs.existsSync(rootDataDir)) {
      return path.join(rootDataDir, 'jewel-suite.db');
    }
    // Fallback if running inside backend or root
    const localData = path.resolve(process.cwd(), 'data');
    return path.join(localData, 'jewel-suite.db');
  }

  // Windows LocalAppData
  const localAppData = process.env.LOCALAPPDATA || path.join(process.env.USERPROFILE || 'C:\\', 'AppData', 'Local');
  return path.join(localAppData, 'JewelSuite', 'data', 'jewel-suite.db');
}

function resolveBackupDir(): string {
  if (process.env.BACKUP_DIR) {
    return path.resolve(process.env.BACKUP_DIR);
  }

  if (isDev) {
    const rootBackupDir = path.resolve(process.cwd(), '../backups');
    if (fs.existsSync(rootBackupDir)) {
      return rootBackupDir;
    }
    return path.resolve(process.cwd(), 'backups');
  }

  const localAppData = process.env.LOCALAPPDATA || path.join(process.env.USERPROFILE || 'C:\\', 'AppData', 'Local');
  return path.join(localAppData, 'JewelSuite', 'backups');
}

export const config = {
  env: NODE_ENV,
  isDev,
  port: parseInt(process.env.PORT || '4500', 10),
  host: process.env.HOST || '127.0.0.1',
  jwtSecret: process.env.JWT_SECRET || 'jewel_suite_offline_default_secret_key_2026',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  dbPath: resolveDbPath(),
  backupDir: resolveBackupDir(),
};
