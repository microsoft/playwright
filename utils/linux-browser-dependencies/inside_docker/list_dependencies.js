#!/usr/bin/env node

const fs = require('fs');
const util = require('util');
const path = require('path');
const {spawn} = require('child_process');
const browserPaths = require('playwright/lib/install/browserPaths.js');

(async () => {
  const allBrowsersPath = browserPaths.browsersPath();
  const {stdout} = await runCommand('find', [allBrowsersPath, '-executable', '-type', 'f']);
  // lddPaths - files we want to run LDD against.
  const lddPaths = stdout.trim().split('\n').map(f => f.trim()).filter(filePath => !filePath.toLowerCase().endsWith('.sh'));
  // List of all shared libraries missing.
  const missingDeps = new Set();
  // Multimap: reverse-mapping from shared library to requiring file.
  const depsToLddPaths = new Map();
  await Promise.all(lddPaths.map(async lddPath => {
    const deps = await missingFileDependencies(lddPath);
    for (const dep of deps) {
      missingDeps.add(dep);
      let depsToLdd = depsToLddPaths.get(dep);
      if (!depsToLdd) {
        depsToLdd = new Set();
        depsToLddPaths.set(dep, depsToLdd);
      }
      depsToLdd.add(lddPath);
    }
  }));
  console.log(`==== MISSING DEPENDENCIES: ${missingDeps.size} ====`);
  console.log([...missingDeps].sort().join('\n'));

  console.log('{');
  for (const dep of missingDeps) {
    const packages = await findPackages(dep);
    if (packages.length === 0) {
      console.log(`  // UNRESOLVED: ${dep} `);
      const depsToLdd = depsToLddPaths.get(dep);
      for (const filePath of depsToLdd)
        console.log(`  // - required by ${filePath}`);
    } else if (packages.length === 1) {
      console.log(`  "${dep}": "${packages[0]}",`);
    } else {
      console.log(`  "${dep}": ${JSON.stringify(packages)},`);
    }
  }
  console.log('}');
})();

async function findPackages(libraryName) {
  const {stdout} = await runCommand('apt-file', ['search', libraryName]);
  if (!stdout.trim())
    return [];
  const libs = stdout.trim().split('\n').map(line => line.split(':')[0]);
  return [...new Set(libs)];
}

async function fileDependencies(filePath) {
  const {stdout} = await lddAsync(filePath);
  const deps = stdout.split('\n').map(line => {
    line = line.trim();
    const missing = line.includes('not found');
    const name = line.split('=>')[0].trim();
    return {name, missing};
  });
  return deps;
}

async function missingFileDependencies(filePath) {
  const deps = await fileDependencies(filePath);
  return deps.filter(dep => dep.missing).map(dep => dep.name);
}

async function lddAsync(filePath) {
  let LD_LIBRARY_PATH = [];
  // Some shared objects inside browser sub-folders link against libraries that
  // ship with the browser. We consider these to be included, so we want to account
  // for them in the LD_LIBRARY_PATH.
  for (let dirname = path.dirname(filePath); dirname !== '/'; dirname = path.dirname(dirname))
    LD_LIBRARY_PATH.push(dirname);
  return await runCommand('ldd', [filePath], {
    cwd: path.dirname(filePath),
    env: {
      ...process.env,
      LD_LIBRARY_PATH: LD_LIBRARY_PATH.join(':'),
    },
  });
}

function runCommand(command, args, options = {}) {
  const childProcess = spawn(command, args, options);

  return new Promise((resolve) => {
    let stdout = '';
    let stderr = '';
    childProcess.stdout.on('data', data => stdout += data);
    childProcess.stderr.on('data', data => stderr += data);
    childProcess.on('close', (code) => {
      resolve({stdout, stderr, code});
    });
  });
}
