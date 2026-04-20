#!/usr/bin/env node

const { run, runCommand } = require('./list_dependencies_base');

run({ findPackages, pickPackage }).catch(err => {
  console.error(err);
  process.exit(1);
});

async function findPackages(libraryName) {
  const {stdout} = await runCommand('apt-file', ['search', libraryName]);
  if (!stdout.trim())
    return [];
  const libs = stdout.trim().split('\n').map(line => line.split(':')[0]);
  return [...new Set(libs)];
}

function pickPackage(library, packages) {
  // Step 1: try to filter out debug, test and dev packages.
  packages = packages.filter(p => !p.endsWith('-dbg') && !p.endsWith('-test') && !p.endsWith('-dev') && !p.endsWith('-mesa'));
  if (packages.length === 1)
    return packages[0];
  // Step 2: use library name to filter packages with the same name.
  const prefix = library.split(/[-.]/).shift().toLowerCase();
  packages = packages.filter(p => p.toLowerCase().startsWith(prefix));
  if (packages.length === 1)
    return packages[0];
  return null;
}
