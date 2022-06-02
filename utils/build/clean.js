const { workspace } = require('../workspace');
const fs = require('fs');
const path = require('path');
const rimraf = require('rimraf');

for (const pkg of workspace.packages()) {
  rimraf.sync(path.join(pkg.path, 'node_modules'));
  rimraf.sync(path.join(pkg.path, 'lib'));
  rimraf.sync(path.join(pkg.path, 'src', 'generated'));
  const bundles = path.join(pkg.path, 'bundles');
  if (fs.existsSync(bundles) && fs.statSync(bundles).isDirectory()) {
    for (const bundle of fs.readdirSync(bundles))
      rimraf.sync(path.join(bundles, bundle, 'node_modules'));
  }
}
