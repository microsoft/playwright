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
import type { T, BabelAPI } from './babelBundle';
import { types, declare, traverse } from './babelBundle';
import { js2ts } from './transform';
const t: typeof T = types;

const fullNames = new Map<string, string | undefined>();
let componentNames: Set<string>;
let componentIdentifiers: Set<T.Identifier>;

export default declare((api: BabelAPI) => {
  api.assertVersion(7);

  const result: babel.PluginObj = {
    name: 'playwright-debug-transform',
    visitor: {
      Program(path) {
        fullNames.clear();
        const result = collectComponentUsages(path.node);
        componentNames = result.names;
        componentIdentifiers = result.identifiers;
      },

      ImportDeclaration(p) {
        const importNode = p.node;
        if (!t.isStringLiteral(importNode.source))
          return;

        let remove = false;
        for (const specifier of importNode.specifiers) {
          if (!componentNames.has(specifier.local.name))
            continue;
          if (t.isImportNamespaceSpecifier(specifier))
            continue;
          const { fullName } = componentInfo(specifier, importNode.source.value, this.filename!);
          fullNames.set(specifier.local.name, fullName);
          remove = true;
        }

        // If one of the imports was a component, consider them all component imports.
        if (remove) {
          p.skip();
          p.remove();
        }
      },

      Identifier(p) {
        if (componentIdentifiers.has(p.node)) {
          const componentName = fullNames.get(p.node.name) || p.node.name;
          p.replaceWith(t.stringLiteral(componentName));
        }
      },

      JSXElement(path) {
        const jsxElement = path.node;
        const jsxName = jsxElement.openingElement.name;
        if (!t.isJSXIdentifier(jsxName))
          return;

        const props: (T.ObjectProperty | T.SpreadElement)[] = [];

        for (const jsxAttribute of jsxElement.openingElement.attributes) {
          if (t.isJSXAttribute(jsxAttribute)) {
            let namespace: T.JSXIdentifier | undefined;
            let name: T.JSXIdentifier | undefined;
            if (t.isJSXNamespacedName(jsxAttribute.name)) {
              namespace = jsxAttribute.name.namespace;
              name = jsxAttribute.name.name;
            } else if (t.isJSXIdentifier(jsxAttribute.name)) {
              name = jsxAttribute.name;
            }
            if (!name)
              continue;
            const attrName = (namespace ? namespace.name + ':' : '') + name.name;
            if (t.isStringLiteral(jsxAttribute.value))
              props.push(t.objectProperty(t.stringLiteral(attrName), jsxAttribute.value));
            else if (t.isJSXExpressionContainer(jsxAttribute.value) && t.isExpression(jsxAttribute.value.expression))
              props.push(t.objectProperty(t.stringLiteral(attrName), jsxAttribute.value.expression));
            else if (jsxAttribute.value === null)
              props.push(t.objectProperty(t.stringLiteral(attrName), t.booleanLiteral(true)));
            else
              props.push(t.objectProperty(t.stringLiteral(attrName), t.nullLiteral()));
          } else if (t.isJSXSpreadAttribute(jsxAttribute)) {
            props.push(t.spreadElement(jsxAttribute.argument));
          }
        }

        const children: (T.Expression | T.SpreadElement)[] = [];
        for (const child of jsxElement.children) {
          if (t.isJSXText(child))
            children.push(t.stringLiteral(child.value));
          else if (t.isJSXElement(child))
            children.push(child);
          else if (t.isJSXExpressionContainer(child) && !t.isJSXEmptyExpression(child.expression))
            children.push(child.expression);
          else if (t.isJSXSpreadChild(child))
            children.push(t.spreadElement(child.expression));
        }

        const componentName = fullNames.get(jsxName.name) || jsxName.name;
        path.replaceWith(t.objectExpression([
          t.objectProperty(t.identifier('kind'), t.stringLiteral('jsx')),
          t.objectProperty(t.identifier('type'), t.stringLiteral(componentName)),
          t.objectProperty(t.identifier('props'), t.objectExpression(props)),
          t.objectProperty(t.identifier('children'), t.arrayExpression(children)),
        ]));
      }
    }
  };
  return result;
});

export function collectComponentUsages(node: T.Node) {
  const importedLocalNames = new Set<string>();
  const names = new Set<string>();
  const identifiers = new Set<T.Identifier>();
  traverse(node, {
    enter: p => {

      // First look at all the imports.
      if (t.isImportDeclaration(p.node)) {
        const importNode = p.node;
        if (!t.isStringLiteral(importNode.source))
          return;

        for (const specifier of importNode.specifiers) {
          if (t.isImportNamespaceSpecifier(specifier))
            continue;
          importedLocalNames.add(specifier.local.name);
        }
      }

      // Treat JSX-everything as component usages.
      if (t.isJSXElement(p.node) && t.isJSXIdentifier(p.node.openingElement.name))
        names.add(p.node.openingElement.name.name);

      // Treat mount(identifier, ...) as component usage if it is in the importedLocalNames list.
      if (t.isAwaitExpression(p.node) && t.isCallExpression(p.node.argument) && t.isIdentifier(p.node.argument.callee) && p.node.argument.callee.name === 'mount') {
        const callExpression = p.node.argument;
        const arg = callExpression.arguments[0];
        if (!t.isIdentifier(arg) || !importedLocalNames.has(arg.name))
          return;

        names.add(arg.name);
        identifiers.add(arg);
      }
    }
  });
  return { names, identifiers };
}

export type ComponentInfo = {
  fullName: string,
  importPath: string,
  isModuleOrAlias: boolean,
  importedName?: string
};

export function componentInfo(specifier: T.ImportSpecifier | T.ImportDefaultSpecifier, importSource: string, filename: string): ComponentInfo {
  const isModuleOrAlias = !importSource.startsWith('.');
  const unresolvedImportPath = path.resolve(path.dirname(filename), importSource);
  // Support following notations for Button.tsx:
  // - import { Button } from './Button.js' - via js2ts, it handles tsx too
  // - import { Button } from './Button' - via require.resolve
  const importPath = isModuleOrAlias ? importSource : js2ts(unresolvedImportPath) || require.resolve(unresolvedImportPath);
  const prefix = importPath.replace(/[^\w_\d]/g, '_');
  const pathInfo = { importPath, isModuleOrAlias };

  if (t.isImportDefaultSpecifier(specifier))
    return { fullName: prefix, ...pathInfo };

  if (t.isIdentifier(specifier.imported))
    return { fullName: prefix + '_' + specifier.imported.name, importedName: specifier.imported.name, ...pathInfo };
  return { fullName: prefix + '_' + specifier.imported.value, importedName: specifier.imported.value, ...pathInfo };
}
