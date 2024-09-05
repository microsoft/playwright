#!/usr/bin/env node
/**
 * Copyright 2019 Google Inc. All rights reserved.
 * Modifications copyright (c) Microsoft Corporation.
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

const fs = require('fs');
const ts = require('typescript');
const path = require('path').posix;
const Module = require('module');
const builtins = new Set(Module.builtinModules);
const packagesDir = path.resolve(path.join(__dirname, '..', 'packages'));

const packages = new Map();
packages.set('web', packagesDir + '/web/src/');
packages.set('injected', packagesDir + '/playwright-core/src/server/injected/');
packages.set('isomorphic', packagesDir + '/playwright-core/src/utils/isomorphic/');
packages.set('testIsomorphic', packagesDir + '/playwright/src/isomorphic/');

const peerDependencies = ['electron', 'react', 'react-dom', 'react-dom/client', '@zip.js/zip.js'];

const depsCache = {};

async function checkDeps() {
  await innerCheckDeps(path.join(packagesDir, 'html-reporter'));
  await innerCheckDeps(path.join(packagesDir, 'playwright-ct-core'));
  await innerCheckDeps(path.join(packagesDir, 'protocol'));
  await innerCheckDeps(path.join(packagesDir, 'recorder'));
  await innerCheckDeps(path.join(packagesDir, 'trace-viewer'));
  await innerCheckDeps(path.join(packagesDir, 'trace'));
  await innerCheckDeps(path.join(packagesDir, 'web'));

  const corePackageJson = await innerCheckDeps(path.join(packagesDir, 'playwright-core'));
  const playwrightPackageJson = await innerCheckDeps(path.join(packagesDir, 'playwright'));

  let hasVersionMismatch = false;
  for (const [key, value] of Object.entries(corePackageJson.dependencies || {})) {
    const value2 = playwrightPackageJson.dependencies[key];
    if (value2 && value2 !== value) {
      hasVersionMismatch = true;
      console.log(`Dependency version mismatch ${key}: ${value} != ${value2}`);
    }
  }
  process.exit(hasVersionMismatch ? 1 : 0);
}

async function innerCheckDeps(root) {
  console.log('Checking DEPS for ' + path.relative(packagesDir, root));
  const deps = new Set();
  const src = path.join(root, 'src');

  let packageJSON;
  try {
    packageJSON = require(path.resolve(path.join(root, 'package.json')));
  } catch {
  }

  const program = ts.createProgram({
    options: {
      allowJs: true,
      target: ts.ScriptTarget.ESNext,
      strict: true,
    },
    rootNames: listAllFiles(src),
  });
  const sourceFiles = program.getSourceFiles();
  const errors = [];
  sourceFiles.filter(x => !x.fileName.includes(path.sep + 'node_modules' + path.sep) && !x.fileName.includes(path.sep + 'bundles' + path.sep)).map(x => visit(x, x.fileName, x.getFullText()));

  if (errors.length) {
    for (const error of errors)
      console.log(error);
    console.log(`--------------------------------------------------------`);
    console.log(`Changing the project structure or adding new components?`);
    console.log(`Update DEPS in ${root}`);
    console.log(`--------------------------------------------------------`);
    process.exit(1);
  }

  if (packageJSON) {
    for (const dep of peerDependencies)
      deps.delete(dep);
    for (const dep of deps) {
      const resolved = require.resolve(dep, { paths: [root] });
      if (dep === resolved || !resolved.includes('node_modules'))
        deps.delete(dep);
    }
    for (const dep of Object.keys(packageJSON.dependencies || {}))
      deps.delete(dep);

    if (deps.size) {
      console.log('Dependencies are not declared in package.json:');
      for (const dep of deps)
        console.log(`  ${dep}`);
      process.exit(1);
    }
  }

  return packageJSON;

  function visit(node, fileName, text) {
    if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
      if (node.importClause) {
        if (node.importClause.isTypeOnly)
          return;
        if (node.importClause.namedBindings && ts.isNamedImports(node.importClause.namedBindings)) {
          if (node.importClause.namedBindings.elements.every(e => e.isTypeOnly))
            return;
        }
      }
      const importName = node.moduleSpecifier.text;
      let importPath;
      if (importName.startsWith('.')) {
        importPath = path.resolve(path.dirname(fileName), importName);
      } else if (importName.startsWith('@')) {
        const tokens = importName.substring(1).split('/');
        const package = tokens[0];
        if (packages.has(package))
          importPath = packages.get(package) + tokens.slice(1).join('/');
      }

      const mergedDeps = calculateDeps(fileName);
      if (mergedDeps.includes('***'))
        return;
      if (importPath) {
        if (!fs.existsSync(importPath)) {
          if (fs.existsSync(importPath + '.ts'))
            importPath = importPath + '.ts';
          else if (fs.existsSync(importPath + '.tsx'))
            importPath = importPath + '.tsx';
          else if (fs.existsSync(importPath + '.d.ts'))
            importPath = importPath + '.d.ts';
        }

        if (!allowImport(fileName, importPath, mergedDeps))
          errors.push(`Disallowed import ${path.relative(root, importPath)} in ${path.relative(root, fileName)}`);
        return;
      }

      const fullStart = node.getFullStart();
      const commentRanges = ts.getLeadingCommentRanges(text, fullStart);
      for (const range of commentRanges || []) {
          const comment = text.substring(range.pos, range.end);
          if (comment.includes('@no-check-deps'))
            return;
      }

      if (importName.startsWith('@'))
        deps.add(importName.split('/').slice(0, 2).join('/'));
      else
        deps.add(importName.split('/')[0]);

      if (!allowExternalImport(importName, packageJSON))
        errors.push(`Disallowed external dependency ${importName} from ${path.relative(root, fileName)}`);
    }
    ts.forEachChild(node, x => visit(x, fileName, text));
  }

  function calculateDeps(from) {
    const fromDirectory = path.dirname(from);
    let depsDirectory = fromDirectory;
    while (depsDirectory.startsWith(packagesDir) && !depsCache[depsDirectory] && !fs.existsSync(path.join(depsDirectory, 'DEPS.list')))
      depsDirectory = path.dirname(depsDirectory);
    if (!depsDirectory.startsWith(packagesDir))
      return [];

    let deps = depsCache[depsDirectory];
    if (!deps) {
      const depsListFile = path.join(depsDirectory, 'DEPS.list');
      deps = {};
      let group = [];
      for (const line of fs.readFileSync(depsListFile, 'utf-8').split('\n').filter(Boolean).filter(l => !l.startsWith('#'))) {
        const groupMatch = line.match(/\[(.*)\]/);
        if (groupMatch) {
          group = [];
          deps[groupMatch[1]] = group;
          continue;
        }
        if (line === '***')
          group.push('***');
        else if (line.startsWith('@'))
          group.push(line.replace(/@([\w-]+)\/(.*)/, (_, arg1, arg2) => packages.get(arg1) + arg2));
        else
          group.push(path.resolve(depsDirectory, line));
      }
      depsCache[depsDirectory] = deps;
    }

    return [...(deps['*'] || []), ...(deps[path.relative(depsDirectory, from)] || [])]
  }

  function allowImport(from, to, mergedDeps) {
    const fromDirectory = path.dirname(from);
    const toDirectory = isDirectory(to) ? to : path.dirname(to);
    if (to === toDirectory)
      to = path.join(to, 'index.ts');
    if (fromDirectory === toDirectory)
      return true;

    for (const dep of mergedDeps) {
      if (dep === '***')
        return true;
      if (to === dep || toDirectory === dep)
        return true;
      if (dep.endsWith('**')) {
        const parent = dep.substring(0, dep.length - 2);
        if (to.startsWith(parent))
          return true;
      }
    }
    return false;
  }

  function allowExternalImport(importName, packageJSON) {
    // Only external imports are relevant. Files in src/web are bundled via webpack.
    if (importName.startsWith('.') || (importName.startsWith('@') && !importName.startsWith('@playwright/')))
      return true;
    if (peerDependencies.includes(importName))
      return true;
    if (!packageJSON)
      return false;
    const match = importName.match(/(@[\w-]+\/)?([^/]+)/);
    const dependency = match[1] ? match[1] + match[2] : match[2];
    if (builtins.has(dependency))
      return true;
    return !!(packageJSON.dependencies || {})[dependency];
  }
}

function listAllFiles(dir) {
  const dirs = fs.readdirSync(dir, { withFileTypes: true });
  const result = [];
  dirs.forEach(d => {
    const res = path.resolve(dir, d.name);
    if (d.isDirectory())
      result.push(...listAllFiles(res));
    else
      result.push(res);
  });
  return result;
}

checkDeps().catch(e => {
  console.error(e && e.stack ? e.stack : e);
  process.exit(1);
});

function isDirectory(dir) {
  return fs.existsSync(dir) && fs.statSync(dir).isDirectory();
}
