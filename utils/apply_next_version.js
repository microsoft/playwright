const path = require('path');
const fs = require('fs');
const execSync = require('child_process').execSync;

if (!process.env.TRAVIS_BUILD_NUMBER) {
  console.log('ERROR: TRAVIS_BUILD_NUMBER is not defined in env!');
  process.exit(1);
  return;
}

// Compare current HEAD to upstream master SHA.
// If they are not equal - refuse to publish since
// we're not tip-of-tree.
const upstream_sha = execSync(`git ls-remote https://github.com/Microsoft/playwright --tags master | cut -f1`).toString('utf8');
const current_sha = execSync(`git rev-parse HEAD`).toString('utf8');
if (upstream_sha.trim() !== current_sha.trim()) {
  console.log('REFUSING TO PUBLISH: this is not tip-of-tree!');
  process.exit(1);
  return;
}


const package = require('../package.json');
let version = package.version;
const dashIndex = version.indexOf('-');
if (dashIndex !== -1)
  version = version.substring(0, dashIndex);
version += '-next.' + process.env.TRAVIS_BUILD_NUMBER;
console.log('Setting version to ' + version);

execSync(`npm --no-git-tag-version version ${version}`);

