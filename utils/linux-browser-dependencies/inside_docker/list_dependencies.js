#!/usr/bin/env node

const fs = require('fs');
const util = require('util');
const path = require('path');
const {spawn} = require('child_process');
const {registryDirectory} = require('playwright-core/lib/server/registry/index');

const readdirAsync = util.promisify(fs.readdir.bind(fs));
const readFileAsync = util.promisify(fs.readFile.bind(fs));

const readline = require('readline');

// These libraries are accessed dynamically by browsers using `dlopen` system call and
// thus have to be installed in the system.
//
// Tip: to assess which libraries are getting opened dynamically, one can use `strace`:
//
//    strace -f -e trace=open,openat <program>
//
const DL_OPEN_LIBRARIES = {
  chromium: [],
  firefox: [],
  webkit: [ 'libGLESv2.so.2' ],
};

(async () => {
  console.log('Working on:', await getDistributionName());
  console.log('Started at:', currentTime());
  const browserDescriptors = (await readdirAsync(registryDirectory)).filter(dir => !dir.startsWith('.')).map(dir => ({
    // Full browser name, e.g. `webkit-1144`
    name: dir,
    // Full patch to browser files
    path: path.join(registryDirectory, dir),
    // All files that we will try to inspect for missing dependencies.
    filePaths: [],
    // All libraries that are missing for the browser.
    missingLibraries: new Set(),
    // All packages required for the browser.
    requiredPackages: new Set(),
    // Libraries that we didn't find a package.
    unresolvedLibraries: new Set(),
  }));

  // Collect all missing libraries for all browsers.
  const allMissingLibraries = new Set();
  for (const descriptor of browserDescriptors) {
    // Browser vendor, can be `webkit`, `firefox` or `chromium`
    const vendor = descriptor.name.split('-')[0];
    for (const library of (DL_OPEN_LIBRARIES[vendor] || [])) {
      descriptor.missingLibraries.add(library);
      allMissingLibraries.add(library);
    }

    const {stdout} = await runCommand('find', [descriptor.path, '-type', 'f']);
    descriptor.filePaths = stdout.trim().split('\n').map(f => f.trim()).filter(filePath => !filePath.toLowerCase().endsWith('.sh'));
    await Promise.all(descriptor.filePaths.map(async filePath => {
      const missingLibraries = await missingFileDependencies(filePath);
      for (const library of missingLibraries) {
        descriptor.missingLibraries.add(library);
        allMissingLibraries.add(library);
      }
    }));
  }

  const libraryToPackage = new Map();
  const ambiguityLibraries = new Map();

  // Map missing libraries to packages that could be installed to fulfill the dependency.
  console.log(`Finding packages for ${allMissingLibraries.size} missing libraries...`);

  for (let i = 0, array = [...allMissingLibraries].sort(); i < allMissingLibraries.size; ++i) {
    const library = array[i];
    const packages = await findPackages(library);

    const progress = `${i + 1}/${allMissingLibraries.size}`;
    console.log(`${progress.padStart(7)}: ${library} => ${JSON.stringify(packages)}`);

    if (!packages.length) {
      const browsersWithMissingLibrary = browserDescriptors.filter(d => d.missingLibraries.has(library)).map(d => d.name).join(', ');
      const PADDING = ''.padStart(7) + '  ';
      console.log(PADDING + `ERROR: failed to resolve '${library}' required by ${browsersWithMissingLibrary}`);
    } else if (packages.length === 1) {
      libraryToPackage.set(library, packages[0]);
    } else {
      ambiguityLibraries.set(library, packages);
    }
  }

  console.log('');
  console.log(`Picking packages for ${ambiguityLibraries.size} libraries that have multiple package candidates`);
  // Pick packages to install to fulfill missing libraries.
  //
  // This is a 2-step process:
  // 1. Pick easy libraries by filtering out debug, test and dev packages.
  // 2. After that, pick packages that we already picked before.

  // Step 1: pick libraries that are easy to pick.
  const totalAmbiguityLibraries = ambiguityLibraries.size;
  for (const [library, packages] of ambiguityLibraries) {
    const package = pickPackage(library, packages);
    if (!package)
      continue;
    libraryToPackage.set(library, package);
    ambiguityLibraries.delete(library);
    const progress = `${totalAmbiguityLibraries - ambiguityLibraries.size}/${totalAmbiguityLibraries}`;
    console.log(`${progress.padStart(7)}: ${library} => ${package}`);
    console.log(''.padStart(9) + `(note) packages are ${JSON.stringify(packages)}`);
  }
  // 2nd pass - prefer packages that we already picked.
  const allUsedPackages = new Set(libraryToPackage.values());
  for (const [library, packages] of ambiguityLibraries) {
    const package = packages.find(package => allUsedPackages.has(package));
    if (!package)
      continue;
    libraryToPackage.set(library, package);
    ambiguityLibraries.delete(library);
    const progress = `${totalAmbiguityLibraries - ambiguityLibraries.size}/${totalAmbiguityLibraries}`;
    console.log(`${progress.padStart(7)}: ${library} => ${package}`);
    console.log(''.padStart(9) + `(note) packages are ${JSON.stringify(packages)}`);
  }

  // 3rd pass - prompt user to resolve ambiguity.

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  const promptAsync = (question) => new Promise(resolve => rl.question(question, resolve));

  // Report all ambiguities that were failed to resolve.
  for (const [library, packages] of ambiguityLibraries) {
    const question = [
      `Pick a package for '${library}':`,
      ...packages.map((package, index) => `  (${index + 1}) ${package}`),
      'Enter number: ',
    ].join('\n');

    const answer = await promptAsync(question);
    const index = parseInt(answer, 10) - 1;
    if (isNaN(index) || (index < 0) || (index >= packages.length)) {
      console.error(`ERROR: unknown index "${answer}". Must be a number between 1 and ${packages.length}`);
      process.exit(1);
    }
    const package = packages[index];

    ambiguityLibraries.delete(library);
    libraryToPackage.set(library, package);
    console.log(answer);
    console.log(`- ${library} => ${package}`);
  }
  rl.close();

  // For each browser build a list of packages to install.
  for (const descriptor of browserDescriptors) {
    for (const library of descriptor.missingLibraries) {
      const package = libraryToPackage.get(library);
      if (package)
        descriptor.requiredPackages.add(package);
      else
        descriptor.unresolvedLibraries.add(library);
    }
  }

  // Formatting results.
  console.log('');
  console.log(`----- Library to package name mapping -----`);
  console.log('{');
  const sortedEntries = [...libraryToPackage.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  for (const [library, package] of sortedEntries)
    console.log(`  "${library}": "${package}",`);
  console.log('}');

  // Packages and unresolved libraries for every browser
  for (const descriptor of browserDescriptors) {
    console.log('');
    console.log(`======= ${descriptor.name}:  required packages =======`);
    const requiredPackages = [...descriptor.requiredPackages].sort();
    console.log(JSON.stringify(requiredPackages, null, 2));
    console.log('');
    console.log(`------- ${descriptor.name}:  unresolved libraries -------`);
    const unresolvedLibraries = [...descriptor.unresolvedLibraries].sort();
    console.log(JSON.stringify(unresolvedLibraries, null, 2));
  }

  const status = browserDescriptors.some(d => d.unresolvedLibraries.size) ? 'FAILED' : 'SUCCESS';
  console.log(`
  ====================
        ${status}
  ====================
  `);
})();

function pickPackage(library, packages) {
  // Step 1: try to filter out debug, test and dev packages.
  packages = packages.filter(package => !package.endsWith('-dbg') && !package.endsWith('-test') && !package.endsWith('-dev') && !package.endsWith('-mesa'));
  if (packages.length === 1)
    return packages[0];
  // Step 2: use library name to filter packages with the same name.
  const prefix = library.split(/[-.]/).shift().toLowerCase();
  packages = packages.filter(package => package.toLowerCase().startsWith(prefix));
  if (packages.length === 1)
    return packages[0];
  return null;
}

async function findPackages(libraryName) {
  const {stdout} = await runCommand('apt-file', ['search', libraryName]);
  if (!stdout.trim())
    return [];
  const libs = stdout.trim().split('\n').map(line => line.split(':')[0]);
  return [...new Set(libs)];
}

async function fileDependencies(filePath) {
  const {stdout, code} = await lddAsync(filePath);
  if (code !== 0)
    return [];
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

async function getDistributionName() {
  const osReleaseText = await readFileAsync('/etc/os-release', 'utf8');
  const fields = new Map();
  for (const line of osReleaseText.split('\n')) {
    const tokens = line.split('=');
    const name = tokens.shift();
    let value = tokens.join('=').trim();
    if (value.startsWith('"') && value.endsWith('"'))
      value = value.substring(1, value.length - 1);
    if (!name)
      continue;
    fields.set(name.toLowerCase(), value);
  }
  return fields.get('pretty_name') || '';
}

function currentTime() {
  const date = new Date();
  const dateTimeFormat = new Intl.DateTimeFormat('en', { year: 'numeric', month: 'short', day: '2-digit' });
  const [{ value: month },,{ value: day },,{ value: year }] = dateTimeFormat .formatToParts(date );
  return `${month} ${day}, ${year}`;
}

