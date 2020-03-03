const package = require('../package.json');
let version = package.version;
const dashIndex = version.indexOf('-');
if (dashIndex !== -1)
  version = version.substring(0, dashIndex);
version += '-next.' + Date.now();
console.log('Setting version to ' + version);

execSync(`npm --no-git-tag-version version ${version}`);

