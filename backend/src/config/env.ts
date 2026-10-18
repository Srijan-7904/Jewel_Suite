import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';

// Load .env if present
dotenv.config();

const NODE_ENV = process.env.NODE_ENV || 'development';
const isDev = NODE_ENV === 'development';

// Determine Database Path:
// In Dev: ./data/jewel-suite.db (relative to project root)
// In Windows Prod: %LOCALAPPDATA%/JewelSuite/data/jewel-suite.db
// In Linux / Render Cloud: $DB_FILE_PATH or $APP_DATA_DIR/data/jewel-suite.db or ./data/jewel-suite.db
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

  if (process.platform === 'win32' && (process.env.LOCALAPPDATA || process.env.USERPROFILE)) {
    const localAppData = process.env.LOCALAPPDATA || path.join(process.env.USERPROFILE || 'C:\\', 'AppData', 'Local');
    return path.join(localAppData, 'JewelSuite', 'data', 'jewel-suite.db');
  }

  // Cloud / Linux / Render default
  const base = getBaseStorageDir();
  return path.join(base, 'data', 'jewel-suite.db');
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

  if (process.platform === 'win32' && (process.env.LOCALAPPDATA || process.env.USERPROFILE)) {
    const localAppData = process.env.LOCALAPPDATA || path.join(process.env.USERPROFILE || 'C:\\', 'AppData', 'Local');
    return path.join(localAppData, 'JewelSuite', 'backups');
  }

  const base = getBaseStorageDir();
  return path.join(base, 'backups');
}

function getBaseStorageDir(): string {
  if (process.env.APP_DATA_DIR) {
    return path.resolve(process.env.APP_DATA_DIR);
  }
  if (isDev) {
    const rootDataDir = path.resolve(process.cwd(), '../data');
    if (fs.existsSync(rootDataDir)) {
      return path.resolve(process.cwd(), '..');
    }
    return process.cwd();
  }
  if (process.platform === 'win32' && (process.env.LOCALAPPDATA || process.env.USERPROFILE)) {
    const localAppData = process.env.LOCALAPPDATA || path.join(process.env.USERPROFILE || 'C:\\', 'AppData', 'Local');
    return path.join(localAppData, 'JewelSuite');
  }
  // Linux / Render / Docker fallback: check ../data or ./data or cwd
  const rootDataDir = path.resolve(process.cwd(), '../data');
  if (fs.existsSync(rootDataDir)) {
    return path.resolve(process.cwd(), '..');
  }
  return process.cwd();
}

const baseDir = getBaseStorageDir();
const dataDir = path.join(baseDir, 'data');
const backupDir = resolveBackupDir();
const shopDir = path.join(baseDir, 'shop');
const exportsDir = path.join(baseDir, 'exports');
const logsDir = path.join(baseDir, 'logs');
const configDir = path.join(baseDir, 'config');

export function ensureLocalDirectoriesExist(): void {
  const dirs = [dataDir, backupDir, shopDir, exportsDir, logsDir, configDir];
  for (const dir of dirs) {
    try {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    } catch {
      // Ignore if folder creation has OS permission restrictions in sandbox
    }
  }
}

export const config = {
  env: NODE_ENV,
  isDev,
  port: parseInt(process.env.PORT || '4500', 10),
  host: process.env.HOST || (isDev ? '127.0.0.1' : '0.0.0.0'),
  jwtSecret: process.env.JWT_SECRET || 'jewel_suite_offline_default_secret_key_2026',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  dbPath: resolveDbPath(),
  backupDir,
  dataDir,
  shopDir,
  exportsDir,
  logsDir,
  configDir,
  baseDir,
};

