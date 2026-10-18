// backend/scripts/copy-migrations.js
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const srcDir = path.resolve(__dirname, '../src/database/migrations');
const distDir = path.resolve(__dirname, '../dist/database/migrations');

if (fs.existsSync(srcDir)) {
  if (!fs.existsSync(distDir)) {
    fs.mkdirSync(distDir, { recursive: true });
  }
  const files = fs.readdirSync(srcDir).filter((f) => f.endsWith('.sql'));
  for (const file of files) {
    fs.copyFileSync(path.join(srcDir, file), path.join(distDir, file));
  }
  console.log(`[Build] Successfully copied ${files.length} SQL migration files to dist/database/migrations`);
} else {
  console.warn(`[Build] Source migrations directory not found at: ${srcDir}`);
}
