const fs = require('fs');
const path = require('path');

const srcDir = path.resolve('frontend/dist');
const destDir = path.resolve('backend/dist/public');

if (fs.existsSync(srcDir)) {
  fs.mkdirSync(destDir, { recursive: true });
  fs.cpSync(srcDir, destDir, { recursive: true });
  console.log(`[Build] Bundled frontend build from ${srcDir} into ${destDir}`);
} else {
  console.warn(`[Build Warning] ${srcDir} does not exist. Frontend was not copied.`);
}
