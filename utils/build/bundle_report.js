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
const checker = require('license-checker');

const ROOT = path.join(__dirname, '..', '..');
const BUILTIN_SET = new Set(require('module').builtinModules);

/** @type {Record<string, { licenseText?: string, repository?: string, licenses?: string }> | null} */
let _licenseMap = null;

/** Memoized license map keyed by "name@version". Lazily populated on
 *  first call; shared across all bundles in a single build run. */
async function getLicenseMap() {
  if (_licenseMap)
    return _licenseMap;
  _licenseMap = await new Promise((resolve, reject) => {
    checker.init({
      start: ROOT,
      production: false,
      customPath: { licenseText: '' },
    }, (err, packages) => err ? reject(err) : resolve(packages));
  });
  return _licenseMap;
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

/** Given one bundle's metafile output, return the deduped sorted list of
 *  "name@version" strings for every inlined npm package. */
function inlinedPackages(outInfo) {
  const keys = new Set();
  for (const inputPath of Object.keys(outInfo.inputs)) {
    if (inputPath.startsWith('(disabled):'))
      continue;
    const dir = packageDirForInput(inputPath);
    if (!dir)
      continue;
    const key = packageKeyForDir(dir);
    if (key)
      keys.add(key);
  }
  return [...keys].sort();
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
async function writeBundleLicenses(outFile, outInfo) {
  const keys = inlinedPackages(outInfo);
  if (keys.length === 0)
    return 0;

  const licenseMap = await getLicenseMap();
  const lines = [];
  lines.push(`${path.relative(ROOT, outFile)}`);
  lines.push('');
  lines.push('THIRD-PARTY SOFTWARE NOTICES AND INFORMATION');
  lines.push('');
  lines.push('The following npm packages are inlined into this bundle.');
  lines.push('');
  for (const key of keys) {
    const info = licenseMap[key];
    const repo = info && info.repository ? info.repository : '';
    lines.push(`- ${key}${repo ? ` (${repo})` : ''}`);
  }
  for (const key of keys) {
    const info = licenseMap[key];
    lines.push('');
    lines.push(`%% ${key} NOTICES AND INFORMATION BEGIN HERE`);
    lines.push('=========================================');
    lines.push((info && info.licenseText) || `(no license text found; declared licenses: ${(info && info.licenses) || 'unknown'})`);
    lines.push('=========================================');
    lines.push(`END OF ${key} NOTICES AND INFORMATION`);
  }
  lines.push('');
  lines.push('SUMMARY');
  lines.push('=========================================');
  lines.push(`Total Packages: ${keys.length}`);
  lines.push('=========================================');

  fs.writeFileSync(outFile + '.LICENSE', lines.join('\n'));
  return keys.length;
}

/** Top-level entry called by EsbuildStep after each bundled build. */
async function writeReports(result) {
  if (!result.metafile)
    return;
  for (const [outFile, outInfo] of Object.entries(result.metafile.outputs)) {
    if (outFile.endsWith('.map'))
      continue;
    const { inputCount, externalCount } = writeBundleReport(result, outFile, outInfo);
    const licCount = await writeBundleLicenses(outFile, outInfo);
    const rel = path.relative(ROOT, outFile);
    const licFragment = licCount ? `, ${licCount} licenses` : '';
    console.log(`     bundle: ${rel}  (${inputCount} files, ${externalCount} external${licFragment}, ${fmtKB(outInfo.bytes)})`);
  }
}

module.exports = { writeReports };
