#!/usr/bin/env node

const { run, runCommand } = require('./list_dependencies_base');

run({ findPackages, pickPackage }).catch(err => {
  console.error(err);
  process.exit(1);
});

async function findPackages(libraryName) {
  // dnf repoquery --whatprovides '<lib>' lists packages providing a file matching the pattern.
  const {stdout} = await runCommand('dnf', ['repoquery', '--setopt=install_weak_deps=False', '-q', '--whatprovides', libraryName]);
  if (!stdout.trim())
    return [];
  // Output format: name-version-release.arch or name.arch
  const pkgs = stdout.trim().split('\n').map(line => {
    // Strip epoch, version, release, arch: keep just the package name
    return line.trim().replace(/-[0-9].*$/, '').replace(/\.[^.]+$/, '');
  }).filter(Boolean);
  return [...new Set(pkgs)];
}

function pickPackage(library, packages) {
  packages = packages.filter(p => !p.endsWith('-debuginfo') && !p.endsWith('-devel') && !p.endsWith('-tests'));
  if (packages.length === 1)
    return packages[0];
  const prefix = library.split(/[-.]/).shift().toLowerCase();
  packages = packages.filter(p => p.toLowerCase().startsWith(prefix));
  if (packages.length === 1)
    return packages[0];
  return null;
}
