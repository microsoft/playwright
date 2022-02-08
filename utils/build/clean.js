const { workspace } = require('../workspace');
const path = require('path');
const rimraf = require('rimraf');
for (const pkg of workspace.packages()) {
  rimraf.sync(path.join(pkg.path, 'lib'));
}
