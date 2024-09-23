// @ts-check
const { workspace } = require('../workspace');
const fs = require('fs');
const path = require('path');

const rmSync = (dir) => fs.rmSync(dir, { recursive: true, force: true, maxRetries: 10 });

for (const pkg of workspace.packages()) {
  rmSync(path.join(pkg.path, 'node_modules'));
  rmSync(path.join(pkg.path, 'lib'));
  rmSync(path.join(pkg.path, 'src', 'generated'));
  const bundles = path.join(pkg.path, 'bundles');
  if (fs.existsSync(bundles) && fs.statSync(bundles).isDirectory()) {
    for (const bundle of fs.readdirSync(bundles, { withFileTypes: true })) {
      if (bundle.isDirectory())
        rmSync(path.join(bundles, bundle.name, 'node_modules'));
    }
  }
}
