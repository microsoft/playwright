/**
 * Copyright (c) Microsoft Corporation.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

// @ts-check

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const BUILTIN_SET = new Set(require('module').builtinModules);

/** @type {Map<string, { license: string, repository?: string }>} */
const _licenseCache = new Map();

/**
 * @param {*} pkg
 * @returns {string}
 */
function normalizeRepositoryUrlToGitHub(pkg) {
  let url = typeof pkg.repository === 'object' ? pkg.repository.url : pkg.repository;
  if (typeof url !== 'string')
    throw new Error(`Malformed repository for ${pkg.name}@${pkg.version}: ${JSON.stringify(pkg.repository)}`);
  url = url.replace(/^git@github\.com:/, 'https://github.com/');
  url = url.replace(/^git:\/\/git@github\.com/, 'https://github.com');
  url = url.replace(/^git\+ssh:\/\/git@github\.com/, 'https://github.com');
  url = url.replace(/^git\+https:\/\//, 'https://');
  url = url.replace(/^http:\/\//, 'https://');
  url = url.replace(/^git:\/\//, 'https://');
  url = url.replace(/^github:/, 'https://github.com/');
  url = url.replace(/\.git$/, '');
  if (url.match(/^[\w-.]+\/[\w-.]+$/))
    url = 'https://github.com/' + url;
  if (!url.match(/^https:\/\/github\.com\/([\w-.]+\/)+[\w-.]+$/))
    throw new Error(`Malformed repository for ${pkg.name}@${pkg.version}: ${JSON.stringify(pkg.repository)}`);
  return url;
}

/**
 * @param {string} dir
 * @returns {string | undefined}
 */
function readLicenseText(dir) {
  const files = fs.readdirSync(dir, { withFileTypes: true });
  const patterns = [/^LICENSE$/i, /^LICENSE-\w+$/i];
  for (const pattern of patterns) {
    for (const file of files) {
      if (!file.isFile())
        continue;
      if (pattern.test(path.basename(file.name, path.extname(file.name))))
        return fs.readFileSync(path.join(dir, file.name), 'utf8').trim();
    }
  }
  // Note: this list ensures we do not accidentally miss a license for some package.
  const knownPackagesWithoutLicense = ['proxy-agent-negotiate'];
  if (!knownPackagesWithoutLicense.some(pkg => dir.endsWith(path.sep + pkg)))
    throw new Error(`Cannot locate license file for ${dir}`);
}

/**
 * @param {string} dir
 * @returns {{ license: string, repository?: string }}
 */
function licenseInfoForDir(dir) {
  let info = _licenseCache.get(dir);
  if (!info) {
    const pkg = JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf8'));
    let license = readLicenseText(dir);
    if (!license) {
      if (!pkg.license)
        throw new Error(`Cannot determine license for ${pkg.name}@${pkg.version} at ${dir}`);
      license = `(no license text found; declared licenses: ${pkg.license})`;
    }
    info = {
      repository: normalizeRepositoryUrlToGitHub(pkg),
      license,
    };
    _licenseCache.set(dir, info);
  }
  return info;
}

/** Extract the owning npm package directory from an input path like
 *  "node_modules/foo/src/index.js" or
 *  "packages/x/node_modules/@scope/foo/lib/x.js". */
function packageDirForInput(inputPath) {
  const segments = inputPath.split('/');
  const nmIdx = segments.lastIndexOf('node_modules');
  if (nmIdx === -1)
    return null;
  const next = segments[nmIdx + 1];
  if (!next)
    return null;
  const pkgSegs = next.startsWith('@')
      ? [next, segments[nmIdx + 2]]
      : [next];
  if (pkgSegs.some(s => !s))
    return null;
  return path.join(ROOT, ...segments.slice(0, nmIdx), 'node_modules', ...pkgSegs);
}

/** Read "name@version" from a package directory, or null. */
function packageKeyForDir(pkgDir) {
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(pkgDir, 'package.json'), 'utf8'));
    if (!pkg.name || !pkg.version)
      return null;
    return `${pkg.name}@${pkg.version}`;
  } catch {
    return null;
  }
}

/** Given one bundle's metafile output, return the deduped sorted list of inlined
 *  npm packages as { key: "name@version", dir } entries. */
function inlinedPackages(outInfo) {
  const byKey = new Map();
  for (const inputPath of Object.keys(outInfo.inputs)) {
    if (inputPath.startsWith('(disabled):'))
      continue;
    const dir = packageDirForInput(inputPath);
    if (!dir)
      continue;
    const key = packageKeyForDir(dir);
    if (key && !byKey.has(key))
      byKey.set(key, dir);
  }
  return [...byKey.keys()].sort().map(key => ({ key, dir: byKey.get(key) }));
}

function fmtKB(bytes) {
  return `${(bytes / 1024).toFixed(1)} KB`;
}

/** Write the .js.txt report (inlined files + externals + sizes). */
function writeBundleReport(result, outFile, outInfo) {
  const inputEntries = Object.entries(outInfo.inputs)
      .filter(([p]) => !p.startsWith('(disabled):'))
      .map(([p, info]) => ({ path: p, bytes: info.bytesInOutput || 0 }))
      .sort((a, b) => a.path.localeCompare(b.path));

  const externals = new Set();
  for (const { path: inFile } of inputEntries) {
    const meta = result.metafile.inputs[inFile];
    if (!meta)
      continue;
    for (const imp of meta.imports || []) {
      if (!imp.external)
        continue;
      if (imp.path.startsWith('node:'))
        continue;
      if (BUILTIN_SET.has(imp.path))
        continue;
      externals.add(imp.path);
    }
  }
  const sortedExternals = [...externals].sort();
  const maxBytes = Math.max(0, ...inputEntries.map(e => e.bytes));
  const bytesColWidth = fmtKB(maxBytes).length;

  const lines = [];
  lines.push(`# ${path.relative(ROOT, outFile)}`);
  lines.push(`# total: ${fmtKB(outInfo.bytes)}`);
  lines.push('');
  lines.push(`## Inlined (${inputEntries.length})`);
  for (const { path: f, bytes } of inputEntries)
    lines.push(`  ${fmtKB(bytes).padStart(bytesColWidth)}  ${f}`);
  lines.push('');
  lines.push(`## External (${sortedExternals.length})`);
  for (const e of sortedExternals)
    lines.push(`  ${e}`);
  lines.push('');

  fs.writeFileSync(outFile + '.txt', lines.join('\n'));
  return { inputCount: inputEntries.length, externalCount: sortedExternals.length };
}

/** Write the .js.LICENSE sidecar. No-op for bundles with no inlined
 *  third-party packages. */
function writeBundleLicenses(outFile, outInfo) {
  const packages = inlinedPackages(outInfo);
  if (packages.length === 0)
    return 0;

  const lines = [];
  lines.push(`${path.relative(ROOT, outFile)}`);
  lines.push('');
  lines.push('THIRD-PARTY SOFTWARE NOTICES AND INFORMATION');
  lines.push('');
  lines.push('The following npm packages are inlined into this bundle.');
  lines.push('');
  for (const { key, dir } of packages) {
    const info = licenseInfoForDir(dir);
    const repo = info.repository ? info.repository : '';
    lines.push(`- ${key}${repo ? ` (${repo})` : ''}`);
  }
  for (const { key, dir } of packages) {
    const info = licenseInfoForDir(dir);
    lines.push('');
    lines.push(`%% ${key} NOTICES AND INFORMATION BEGIN HERE`);
    lines.push('=========================================');
    lines.push(info.license);
    lines.push('=========================================');
    lines.push(`END OF ${key} NOTICES AND INFORMATION`);
  }
  lines.push('');
  lines.push('SUMMARY');
  lines.push('=========================================');
  lines.push(`Total Packages: ${packages.length}`);
  lines.push('=========================================');

  fs.writeFileSync(outFile + '.LICENSE', lines.join('\n'));
  return packages.length;
}

/** Top-level entry called by EsbuildStep after each bundled build. */
function writeReports(result) {
  if (!result.metafile)
    return;
  for (const [outFile, outInfo] of Object.entries(result.metafile.outputs)) {
    if (outFile.endsWith('.map'))
      continue;
    const { inputCount, externalCount } = writeBundleReport(result, outFile, outInfo);
    const licCount = writeBundleLicenses(outFile, outInfo);
    const rel = path.relative(ROOT, outFile);
    const licFragment = licCount ? `, ${licCount} licenses` : '';
    console.log(`     bundle: ${rel}  (${inputCount} files, ${externalCount} external${licFragment}, ${fmtKB(outInfo.bytes)})`);
  }
}

module.exports = { writeReports };
