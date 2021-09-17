const { spawnSync } = require("child_process");
const { packages } = require("./listPackages");
const path = require('path');

for (const packageDir of packages) {
  console.log(process.cwd());
  spawnSync('npx', [
    'babel',
    '--extensions', '.ts',
    '--out-dir', path.join(packageDir, 'lib'),
    path.join(packageDir, 'src')
  ], { stdio: 'inherit', cwd: process.cwd() });
} 