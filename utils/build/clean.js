// @ts-check
const fs = require('fs');
const path = require('path');

const rmSync = (dir) => fs.rmSync(dir, { recursive: true, force: true, maxRetries: 10 });

const packagesDir = path.join(__dirname, '..', '..', 'packages');
for (const entry of fs.readdirSync(packagesDir, { withFileTypes: true })) {
  if (!entry.isDirectory())
    continue;
  const pkgPath = path.join(packagesDir, entry.name);
  rmSync(path.join(pkgPath, 'node_modules'));
  rmSync(path.join(pkgPath, 'lib'));
  rmSync(path.join(pkgPath, 'dist'));
  rmSync(path.join(pkgPath, 'src', 'generated'));
  const bundles = path.join(pkgPath, 'bundles');
  if (fs.existsSync(bundles) && fs.statSync(bundles).isDirectory()) {
    for (const bundle of fs.readdirSync(bundles, { withFileTypes: true })) {
      if (bundle.isDirectory())
        rmSync(path.join(bundles, bundle.name, 'node_modules'));
    }
  }
}
