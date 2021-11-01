const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');

const { packages } = require('./list_packages.js');

(async () => {
  const version = process.argv[2];
  if (!version)
    throw new Error('Please specify version! See --help for more information.');
  if (process.argv[2] === '--help')
    throw new Error(`Usage: node ${path.relative(process.cwd(), __filename)} <version>`);
  const rootDir = path.join(__dirname, '..');

  // 1. update the package.json (playwright-internal) with the new version
  execSync(`npm version --no-git-tag-version ${version}`, {
    stdio: 'inherit',
    cwd: rootDir,
  });
  // 2. Distribute new version to all packages and its dependencies
  execSync(`node ${path.join(__dirname, 'prepare_packages.js')}`, {
    stdio: 'inherit',
    cwd: rootDir,
  });

  // 3. update the package-lock.json (playwright-internal) with the new version.
  // Workaround for: https://github.com/npm/cli/issues/3940
  {
    const packageLockPath = path.join(rootDir, 'package-lock.json');
    const packageLock = JSON.parse(fs.readFileSync(packageLockPath, 'utf8'));
    for (const package of packages.map(package => path.basename(package))) {
      packageLock['packages']['packages/' + package].version = version;
      if (packageLock['packages']['packages/' + package].dependencies?.['playwright-core'])
        packageLock['packages']['packages/playwright-test']['dependencies']['playwright-core'] = '=' + version;
    }
    fs.writeFileSync(packageLockPath, JSON.stringify(packageLock, null, 2) + '\n');
  }
  // 4. Verify integrity with npm i
  execSync('npm install', {
    stdio: 'inherit',
    cwd: rootDir,
  });

})().catch(err => {
  console.error(err);
  process.exit(1);
})