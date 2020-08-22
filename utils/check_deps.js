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
  process.exit(errors.length ? 1 : 0);

  function visit(node, fileName) {
    if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
      const importName = node.moduleSpecifier.text;
      const importPath = path.resolve(path.dirname(fileName), importName);
      if (!allowImport(fileName, importPath))
        errors.push(`Disallowed import from ${path.relative(root, fileName)} to ${path.relative(root, importPath)}`);
    }
    ts.forEachChild(node, x => visit(x, fileName));
  }

  function allowImport(from, to) {
    from = from.substring(from.indexOf('src' + path.sep)).replace(/\\/g, '/');
    to = to.substring(to.indexOf('src' + path.sep)).replace(/\\/g, '/') + '.ts';
    while (from.lastIndexOf('/') !== -1) {
      from = from.substring(0, from.lastIndexOf('/'));
      const allowed = DEPS.get(from + '/');
      if (!allowed)
        continue;
      for (const prefix of allowed) {
        if (to.startsWith(prefix))
          return true;
      }
      return false;
    }
    return false;
  }
}

const DEPS = new Map([
  ['src/utils/', ['src/utils/']],
  ['src/protocol/', ['src/protocol/', 'src/utils/']],
  ['src/rpc/client/', ['src/rpc/client/', 'src/utils/', 'src/protocol/', 'src/chromium/protocol.ts']],
  ['src/', ['src/']],  // Allow everything else for now.
]);

checkDeps();
