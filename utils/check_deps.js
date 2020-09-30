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

const ts = require('typescript');
const path = require('path');
const Source = require('./doclint/Source');

async function checkDeps() {
  const root = path.normalize(path.join(__dirname, '..'));
  const src = path.normalize(path.join(__dirname, '..', 'src'));
  const sources = await Source.readdir(src);
  const program = ts.createProgram({
    options: {
      allowJs: true,
      target: ts.ScriptTarget.ESNext,
      strict: true,
    },
    rootNames: sources.map(source => source.filePath()),
  });
  const sourceFiles = program.getSourceFiles();
  const errors = [];
  sourceFiles.filter(x => !x.fileName.includes('node_modules')).map(x => visit(x, x.fileName));
  for (const error of errors)
    console.log(error);
  if (errors.length) {
    console.log(`--------------------------------------------------------`);
    console.log(`Changing the project structure or adding new components?`);
    console.log(`Update DEPS in //${path.relative(root, __filename)}.`);
    console.log(`--------------------------------------------------------`);
  }
  process.exit(errors.length ? 1 : 0);

  function visit(node, fileName) {
    if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
      const importName = node.moduleSpecifier.text;
      const importPath = path.resolve(path.dirname(fileName), importName) + '.ts';
      if (!allowImport(fileName, importPath))
        errors.push(`Disallowed import from ${path.relative(root, fileName)} to ${path.relative(root, importPath)}`);
    }
    ts.forEachChild(node, x => visit(x, fileName));
  }

  function allowImport(from, to) {
    from = from.substring(from.indexOf('src' + path.sep)).replace(/\\/g, '/');
    to = to.substring(to.indexOf('src' + path.sep)).replace(/\\/g, '/');
    const fromDirectory = from.substring(0, from.lastIndexOf('/') + 1);
    const toDirectory = to.substring(0, to.lastIndexOf('/') + 1);
    if (fromDirectory === toDirectory)
      return true;

    while (!DEPS[from]) {
      if (from.endsWith('/'))
        from = from.substring(0, from.length - 1);
      if (from.lastIndexOf('/') === -1)
        throw new Error(`Cannot find DEPS for ${fromDirectory}`);
      from = from.substring(0, from.lastIndexOf('/') + 1);
    }

    for (const dep of DEPS[from]) {
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
}

const DEPS = {};

DEPS['src/protocol/'] = ['src/utils/'];
DEPS['src/install/'] = ['src/utils/'];

// Client depends on chromium protocol for types.
DEPS['src/client/'] = ['src/utils/', 'src/protocol/', 'src/server/chromium/protocol.ts'];

DEPS['src/dispatchers/'] = ['src/utils/', 'src/protocol/', 'src/server/**'];

// Generic dependencies for server-side code.
DEPS['src/server/'] = [
  'src/utils/',
  'src/generated/',
  // Can depend on files directly in the server directory.
  'src/server/',
  // Can depend on any files in these subdirectories.
  'src/server/common/**',
  'src/server/injected/**',
];

// No dependencies for code shared between node and page.
DEPS['src/server/common/'] = [];
// Strict dependencies for injected code.
DEPS['src/server/injected/'] = ['src/server/common/'];

// Electron uses chromium internally.
DEPS['src/server/electron/'] = [...DEPS['src/server/'], 'src/server/chromium/'];

DEPS['src/server/playwright.ts'] = [...DEPS['src/server/'], 'src/server/chromium/', 'src/server/webkit/', 'src/server/firefox/'];
DEPS['src/driver.ts'] = DEPS['src/inprocess.ts'] = DEPS['src/browserServerImpl.ts'] = ['src/**'];

// Tracing is a client/server plugin, nothing should depend on it.
DEPS['src/trace/'] = ['src/utils/', 'src/client/**', 'src/server/**'];

// Debug is a server plugin, nothing should depend on it.
DEPS['src/debug/'] = ['src/utils/', 'src/generated/', 'src/server/**', 'src/debug/**'];

checkDeps();
