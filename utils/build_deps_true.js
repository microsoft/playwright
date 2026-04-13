#!/usr/bin/env node
/**
 * Copyright (c) Microsoft Corporation.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

// @ts-check

/**
 * Builds DEPS.true files next to every DEPS.list.
 * Each DEPS.true has a [filename] section per source file in the directory,
 * listing the actual cross-directory dependencies (resolved import targets)
 * that the file uses. Type-only imports are excluded.
 */

const fs = require('fs');
const ts = require('typescript');
const path = require('path').posix;
const Module = require('module');
const builtins = new Set(Module.builtinModules);
const packagesDir = path.resolve(path.join(__dirname, '..', 'packages'));

const packages = new Map();
packages.set('web', packagesDir + '/web/src/');
packages.set('injected', packagesDir + '/injected/src/');
packages.set('isomorphic', packagesDir + '/isomorphic/');
packages.set('utils', packagesDir + '/utils/');
packages.set('testIsomorphic', packagesDir + '/playwright/src/isomorphic/');

async function main() {
  // Find every DEPS.list under packages/.
  const depsListDirs = [];
  findDepsListDirs(packagesDir, depsListDirs);

  // Group DEPS.list dirs by the top-level source root they belong to, so we
  // only create one TS program per root.
  /** @type {Map<string, string[]>} sourceRoot -> depsListDirs */
  const rootToDirs = new Map();
  for (const dir of depsListDirs) {
    const sourceRoot = findSourceRoot(dir);
    if (!rootToDirs.has(sourceRoot))
      rootToDirs.set(sourceRoot, []);
    rootToDirs.get(sourceRoot).push(dir);
  }

  const allDepsListDirSet = new Set(depsListDirs);
  for (const [sourceRoot, dirs] of rootToDirs)
    buildDepsTrue(sourceRoot, dirs, allDepsListDirSet);
}

/**
 * Walk up from a DEPS.list directory to find the source root (the directory
 * containing all the TS files we need to parse). This is typically `src/` or
 * the package root itself (for packages like utils/ or isomorphic/).
 */
function findSourceRoot(dir) {
  // Walk up until we hit a package root (directory directly under packagesDir)
  // or a `src/` boundary.
  let current = dir;
  while (current !== packagesDir) {
    const parent = path.dirname(current);
    if (parent === packagesDir)
      return current; // package root (e.g., packages/utils)
    if (path.basename(current) === 'src')
      return current;
    current = parent;
  }
  return dir;
}

function buildDepsTrue(sourceRoot, depsListDirs, allDepsListDirSet) {
  const allFiles = listAllFiles(sourceRoot);
  if (allFiles.length === 0)
    return;

  const program = ts.createProgram({
    options: {
      allowJs: true,
      target: ts.ScriptTarget.ESNext,
      strict: true,
    },
    rootNames: allFiles,
  });

  const sourceFiles = program.getSourceFiles().filter(
    x => !x.fileName.includes(path.sep + 'node_modules' + path.sep) &&
         !x.fileName.includes(path.sep + 'bundles' + path.sep)
  );

  // Collect imports per source file.
  /** @type {Map<string, Set<string>>} */
  const fileImports = new Map();
  for (const sf of sourceFiles) {
    const imports = new Set();
    fileImports.set(sf.fileName, imports);
    collectImports(sf, sf.fileName, sf.getFullText(), imports);
  }

  for (const depsDir of depsListDirs)
    writeDepsTrue(depsDir, fileImports, allDepsListDirSet);
}

function collectImports(node, fileName, text, imports) {
  if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
    // Skip type-only imports.
    if (node.importClause) {
      if (node.importClause.isTypeOnly)
        return;
      if (node.importClause.namedBindings && ts.isNamedImports(node.importClause.namedBindings)) {
        if (node.importClause.namedBindings.elements.every(e => e.isTypeOnly))
          return;
      }
    }

    // Skip @no-check-deps.
    const fullStart = node.getFullStart();
    const commentRanges = ts.getLeadingCommentRanges(text, fullStart);
    for (const range of commentRanges || []) {
      const comment = text.substring(range.pos, range.end);
      if (comment.includes('@no-check-deps'))
        return;
    }

    const importName = node.moduleSpecifier.text;
    let importPath;
    if (importName.startsWith('.')) {
      importPath = path.resolve(path.dirname(fileName), importName);
    } else if (importName.startsWith('@')) {
      const tokens = importName.substring(1).split('/');
      const pkg = tokens[0];
      if (packages.has(pkg))
        importPath = packages.get(pkg) + tokens.slice(1).join('/');
    }

    if (importPath) {
      // Resolve to actual file.
      if (!fs.existsSync(importPath)) {
        if (fs.existsSync(importPath + '.ts'))
          importPath = importPath + '.ts';
        else if (fs.existsSync(importPath + '.tsx'))
          importPath = importPath + '.tsx';
        else if (fs.existsSync(importPath + '.d.ts'))
          importPath = importPath + '.d.ts';
      }
      imports.add(importPath);
    } else if (!builtins.has(importName)) {
      // External (node_modules) import.
      imports.add('node_modules/' + importName);
    }
  }
  ts.forEachChild(node, x => collectImports(x, fileName, text, imports));
}

function writeDepsTrue(depsDir, fileImports, allDepsListDirs) {
  // Find source files governed by this DEPS.list: files in this directory
  // plus files in subdirectories that don't have their own DEPS.list.
  const governedFiles = [];
  collectGovernedFiles(depsDir, governedFiles, allDepsListDirs);
  governedFiles.sort();

  const lines = [];
  for (const filePath of governedFiles) {
    const imports = fileImports.get(filePath);
    if (!imports || imports.size === 0)
      continue;

    // Include all deps: cross-directory and same-directory (strict mode needs both).
    const deps = [];
    for (const imp of imports)
      deps.push(imp);

    if (deps.length === 0)
      continue;

    // Format deps relative to the DEPS.list directory.
    const formatted = deps
      .map(dep => {
        if (dep.startsWith('node_modules/'))
          return dep;
        return path.relative(depsDir, dep);
      })
      .sort();

    const fileName = path.relative(depsDir, filePath);
    lines.push(`[${fileName}]`);
    for (const dep of formatted)
      lines.push(dep);
    lines.push('');
  }

  const outPath = path.join(depsDir, 'DEPS.true');
  if (lines.length === 0) {
    // Remove stale DEPS.true if no cross-dir deps exist.
    if (fs.existsSync(outPath))
      fs.unlinkSync(outPath);
    return;
  }

  fs.writeFileSync(outPath, lines.join('\n') + '\n');
  console.log('Wrote ' + path.relative(packagesDir, outPath));
}

/**
 * Collect source files governed by this DEPS.list: files directly in depsDir
 * plus files in subdirectories that don't have their own DEPS.list.
 */
function collectGovernedFiles(dir, result, allDepsListDirs) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.resolve(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === 'bundles')
        continue;
      // Stop recursion at subdirectories that have their own DEPS.list.
      if (allDepsListDirs.has(full))
        continue;
      collectGovernedFiles(full, result, allDepsListDirs);
    } else if (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx')) {
      result.push(full);
    }
  }
}

function findDepsListDirs(dir, result) {
  if (fs.existsSync(path.join(dir, 'DEPS.list')))
    result.push(dir);
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory() && entry.name !== 'node_modules' && entry.name !== 'bundles')
      findDepsListDirs(path.resolve(dir, entry.name), result);
  }
}

function listAllFiles(dir) {
  const result = [];
  for (const d of fs.readdirSync(dir, { withFileTypes: true })) {
    const res = path.resolve(dir, d.name);
    if (d.isDirectory() && d.name !== 'node_modules' && d.name !== 'bundles')
      result.push(...listAllFiles(res));
    else if (d.name.endsWith('.ts') || d.name.endsWith('.tsx'))
      result.push(res);
  }
  return result;
}

function isDirectory(p) {
  return fs.existsSync(p) && fs.statSync(p).isDirectory();
}

main().catch(e => {
  console.error(e && e.stack ? e.stack : e);
  process.exit(1);
});
