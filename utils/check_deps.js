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
const path = require('path');

const packagesDir = path.normalize(path.join(__dirname, '..', 'packages'));
const packages = fs.readdirSync(packagesDir);
const peerDependencies = ['electron', 'react', 'react-dom', '@zip.js/zip.js'];

async function checkDeps() {
  await innerCheckDeps(path.join(packagesDir, 'recorder'), true, true);
  await innerCheckDeps(path.join(packagesDir, 'trace-viewer'), true, true);

  const corePackageJson = await innerCheckDeps(path.join(packagesDir, 'playwright-core'), true, true);
  const testPackageJson = await innerCheckDeps(path.join(packagesDir, 'playwright-test'), true, true);

  let hasVersionMismatch = false;
  for (const [key, value] of Object.entries(corePackageJson.dependencies)) {
    const value2 = testPackageJson.dependencies[key];
    if (value2 && value2 !== value) {
      hasVersionMismatch = true;
      console.log(`Dependency version mismatch ${key}: ${value} != ${value2}`);
    }
  }
  process.exit(hasVersionMismatch ? 1 : 0);
}

async function innerCheckDeps(root, checkDepsFile, checkPackageJson) {
  console.log('Testing', root);
  const deps = new Set();
  const src = path.join(root, 'src');
  const depsFile = checkDepsFile ? loadDEPSFile(src) : {};
  const packageJSON = require(path.join(root, 'package.json'));
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
  const usedDeps = new Set(['/']);
  sourceFiles.filter(x => !x.fileName.includes('node_modules')).map(x => visit(x, x.fileName));
  for (const key of Object.keys(depsFile)) {
    if (!usedDeps.has(key) && depsFile[key].length)
      errors.push(`Stale DEPS entry "${key}"`);
  }
  if (checkDepsFile && errors.length) {
    for (const error of errors)
      console.log(error);
    console.log(`--------------------------------------------------------`);
    console.log(`Changing the project structure or adding new components?`);
    console.log(`Update DEPS in ${root}`);
    console.log(`--------------------------------------------------------`);
    process.exit(1);
  }

  if (checkPackageJson) {
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

  function visit(node, fileName) {
    if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
      if (node.importClause && node.importClause.isTypeOnly)
        return;
      const importName = node.moduleSpecifier.text;
      let importPath;
      if (importName.startsWith('.')) {
        importPath = path.resolve(path.dirname(fileName), importName);
      } else if (importName.startsWith('@')) {
        const tokens = importName.substring(1).split('/');
        const package = tokens[0];
        if (packages.includes(package))
          importPath = packagesDir + '/' + tokens[0] + '/src/' + tokens.slice(1).join('/');
      }

      if (importPath) {
        if (!fs.existsSync(importPath)) {
          if (fs.existsSync(importPath + '.ts'))
            importPath = importPath + '.ts';
          else if (fs.existsSync(importPath + '.tsx'))
            importPath = importPath + '.tsx';
          else if (fs.existsSync(importPath + '.d.ts'))
            importPath = importPath + '.d.ts';
        }

        if (checkDepsFile && !allowImport(depsFile, fileName, importPath))
          errors.push(`Disallowed import ${path.relative(root, importPath)} in ${path.relative(root, fileName)}`);
        return;
      }

      if (importName.startsWith('@'))
        deps.add(importName.split('/').slice(0, 2).join('/'));
      else
        deps.add(importName.split('/')[0]);

      if (checkDepsFile && !allowExternalImport(importName, packageJSON))
        errors.push(`Disallowed external dependency ${importName} from ${path.relative(root, fileName)}`);
    }
    ts.forEachChild(node, x => visit(x, fileName));
  }

  function allowImport(depsFile, from, to) {
    const fromDirectory = path.dirname(from);
    const toDirectory = path.dirname(to);
    if (fromDirectory === toDirectory)
      return true;

    while (!depsFile[from]) {
      if (from.lastIndexOf('/') === -1)
        return false;
      from = from.substring(0, from.lastIndexOf('/'));
    }

    usedDeps.add(from);
    for (const dep of depsFile[from]) {
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
    if (importName.startsWith('.') || importName.startsWith('@'))
      return true;
    if (peerDependencies.includes(importName))
      return true;
    try {
      const resolvedImport = require.resolve(importName);
      const resolvedImportRelativeToNodeModules = path.relative(path.join(root, 'node_modules'), resolvedImport);
      // Filter out internal Node.js modules
      if (!resolvedImportRelativeToNodeModules.startsWith(importName))
        return true;
    } catch (error) {
      if (error.code !== 'MODULE_NOT_FOUND')
        throw error;
    }
    return !!(packageJSON.dependencies || {})[importName];
  }
}

function listAllFiles(dir) {
  const dirs = fs.readdirSync(dir, { withFileTypes: true });
  const result = [];
  dirs.map(d => {
    const res = path.resolve(dir, d.name);
    if (d.isDirectory())
      result.push(...listAllFiles(res));
    else
      result.push(res);
  });
  return result;
}

function loadDEPSFile(src) {
  const deps = require(path.join(src, 'DEPS'));
  const resolved = {};
  for (let [key, values] of Object.entries(deps)) {
    if (key === '/')
      key = '';
    resolved[path.resolve(src, key)] = values.map(v => {
      if (v.startsWith('@')) {
        const tokens = v.substring(1).split('/');
        return path.resolve(packagesDir, tokens[0], 'src', ...tokens.slice(1));
      }
      return path.resolve(src, v);
    });
  }
  return resolved;
}

checkDeps().catch(e => {
  console.error(e && e.stack ? e.stack : e);
  process.exit(1);
});
