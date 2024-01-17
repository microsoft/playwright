/**
 * Copyright (c) Microsoft Corporation.
 *
 * Licensed under the Apache License, Version 2.0 (the 'License');
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an 'AS IS' BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import path from 'path';
import type { T, BabelAPI, PluginObj } from 'playwright/src/transform/babelBundle';
import { types, declare, traverse } from 'playwright/lib/transform/babelBundle';
import { resolveImportSpecifierExtension } from 'playwright/lib/util';
import { setTransformData } from 'playwright/lib/transform/transform';
const t: typeof T = types;

let jsxComponentNames: Set<string>;
let importInfos: Map<string, ImportInfo>;

export default declare((api: BabelAPI) => {
  api.assertVersion(7);

  const result: PluginObj = {
    name: 'playwright-debug-transform',
    visitor: {
      Program: {
        enter(path) {
          jsxComponentNames = collectJsxComponentUsages(path.node);
          importInfos = new Map();
        },
        exit(path) {
          let firstDeclaration: any;
          let lastImportDeclaration: any;
          path.get('body').forEach(p => {
            if (p.isImportDeclaration())
              lastImportDeclaration = p;
            else if (!firstDeclaration)
              firstDeclaration = p;
          });
          const insertionPath = lastImportDeclaration || firstDeclaration;
          if (!insertionPath)
            return;

          for (const [localName, componentImport] of [...importInfos.entries()].reverse()) {
            insertionPath.insertAfter(
                t.variableDeclaration(
                    'const',
                    [
                      t.variableDeclarator(
                          t.identifier(localName),
                          t.objectExpression([
                            t.objectProperty(t.identifier('__pw_type'), t.stringLiteral('importRef')),
                            t.objectProperty(t.identifier('id'), t.stringLiteral(componentImport.id)),
                          ]),
                      )
                    ]
                )
            );
          }
          setTransformData('playwright-ct-core', [...importInfos.values()]);
        }
      },

      ImportDeclaration(p) {
        const importNode = p.node;
        if (!t.isStringLiteral(importNode.source))
          return;

        const ext = path.extname(importNode.source.value);

        // Convert all non-JS imports into refs.
        if (!allJsExtensions.has(ext)) {
          for (const specifier of importNode.specifiers) {
            if (t.isImportNamespaceSpecifier(specifier))
              continue;
            const { localName, info } = importInfo(importNode, specifier, this.filename!);
            importInfos.set(localName, info);
          }
          p.skip();
          p.remove();
          return;
        }

        // Convert JS imports that are used as components in JSX expressions into refs.
        let importCount = 0;
        for (const specifier of importNode.specifiers) {
          if (t.isImportNamespaceSpecifier(specifier))
            continue;
          const { localName, info } = importInfo(importNode, specifier, this.filename!);
          if (jsxComponentNames.has(localName)) {
            importInfos.set(localName, info);
            ++importCount;
          }
        }

        // All the imports were from JSX => delete.
        if (importCount && importCount === importNode.specifiers.length) {
          p.skip();
          p.remove();
        }
      },

      MemberExpression(path) {
        if (!t.isIdentifier(path.node.object))
          return;
        if (!importInfos.has(path.node.object.name))
          return;
        if (!t.isIdentifier(path.node.property))
          return;
        path.replaceWith(
            t.objectExpression([
              t.spreadElement(t.identifier(path.node.object.name)),
              t.objectProperty(t.identifier('property'), t.stringLiteral(path.node.property.name)),
            ])
        );
      },
    }
  };
  return result;
});

function collectJsxComponentUsages(node: T.Node): Set<string> {
  const names = new Set<string>();
  traverse(node, {
    enter: p => {
      // Treat JSX-everything as component usages.
      if (t.isJSXElement(p.node)) {
        if (t.isJSXIdentifier(p.node.openingElement.name))
          names.add(p.node.openingElement.name.name);
        if (t.isJSXMemberExpression(p.node.openingElement.name) && t.isJSXIdentifier(p.node.openingElement.name.object) && t.isJSXIdentifier(p.node.openingElement.name.property))
          names.add(p.node.openingElement.name.object.name);
      }
    }
  });
  return names;
}

export type ImportInfo = {
  id: string;
  isModuleOrAlias: boolean;
  importPath: string;
  remoteName: string | undefined;
};

export function importInfo(importNode: T.ImportDeclaration, specifier: T.ImportSpecifier | T.ImportDefaultSpecifier, filename: string): { localName: string, info: ImportInfo } {
  const importSource = importNode.source.value;
  const isModuleOrAlias = !importSource.startsWith('.');
  const unresolvedImportPath = path.resolve(path.dirname(filename), importSource);
  // Support following notations for Button.tsx:
  // - import { Button } from './Button.js' - via resolveImportSpecifierExtension
  // - import { Button } from './Button' - via require.resolve
  const importPath = isModuleOrAlias ? importSource : resolveImportSpecifierExtension(unresolvedImportPath) || require.resolve(unresolvedImportPath);
  const idPrefix = importPath.replace(/[^\w_\d]/g, '_');

  const result: ImportInfo = {
    id: idPrefix,
    importPath,
    isModuleOrAlias,
    remoteName: undefined,
  };

  if (t.isImportDefaultSpecifier(specifier)) {
  } else if (t.isIdentifier(specifier.imported)) {
    result.remoteName = specifier.imported.name;
  } else {
    result.remoteName = specifier.imported.value;
  }

  if (result.remoteName)
    result.id += '_' + result.remoteName;
  return { localName: specifier.local.name, info: result };
}

const allJsExtensions = new Set(['.js', '.jsx', '.cjs', '.mjs', '.ts', '.tsx', '.cts', '.mts', '']);
