const fs = require('fs');
const path = require('path');

const targets = [
  'node_modules/.bin/vite',
  'node_modules/.bin/esbuild',
  'node_modules/@esbuild/linux-x64/bin/esbuild',
  'node_modules/esbuild/bin/esbuild',
];

for (const rel of targets) {
  const abs = path.join(process.cwd(), rel);
  try {
    if (fs.existsSync(abs)) {
      fs.chmodSync(abs, 0o755);
      console.log(`[permissions] chmod +x ${rel}`);
    }
  } catch (err) {
    console.log(`[permissions] skipped ${rel}: ${err.message}`);
  }
}
