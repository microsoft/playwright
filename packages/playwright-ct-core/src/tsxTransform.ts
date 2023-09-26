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
import type { T, BabelAPI } from 'playwright/src/transform/babelBundle';
import { types, declare, traverse } from 'playwright/lib/transform/babelBundle';
import { resolveImportSpecifierExtension } from 'playwright/lib/util';
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

        let components = 0;
        for (const specifier of importNode.specifiers) {
          const specifierName = specifier.local.name;
          const componentName = componentNames.has(specifierName) ? specifierName : [...componentNames].find(c => c.startsWith(specifierName + '.'));
          if (!componentName)
            continue;
          if (t.isImportNamespaceSpecifier(specifier))
            continue;
          const { fullName } = componentInfo(specifier, importNode.source.value, this.filename!, componentName);
          fullNames.set(componentName, fullName);
          ++components;
        }

        // All the imports were components => delete.
        if (components && components === importNode.specifiers.length) {
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
        let nameOrExpression: string = '';
        if (t.isJSXIdentifier(jsxName))
          nameOrExpression = jsxName.name;
        else if (t.isJSXMemberExpression(jsxName) && t.isJSXIdentifier(jsxName.object) && t.isJSXIdentifier(jsxName.property))
          nameOrExpression = jsxName.object.name + '.' + jsxName.property.name;
        if (!nameOrExpression)
          return;
        const componentName = fullNames.get(nameOrExpression) || nameOrExpression;

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
      if (t.isJSXElement(p.node)) {
        if (t.isJSXIdentifier(p.node.openingElement.name))
          names.add(p.node.openingElement.name.name);
        if (t.isJSXMemberExpression(p.node.openingElement.name) && t.isJSXIdentifier(p.node.openingElement.name.object) && t.isJSXIdentifier(p.node.openingElement.name.property))
          names.add(p.node.openingElement.name.object.name + '.' + p.node.openingElement.name.property.name);
      }

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
  fullName: string;
  importPath: string;
  isModuleOrAlias: boolean;
  importedName?: string;
  importedNameProperty?: string;
  deps: string[];
};

export function componentInfo(specifier: T.ImportSpecifier | T.ImportDefaultSpecifier, importSource: string, filename: string, componentName: string): ComponentInfo {
  const isModuleOrAlias = !importSource.startsWith('.');
  const unresolvedImportPath = path.resolve(path.dirname(filename), importSource);
  // Support following notations for Button.tsx:
  // - import { Button } from './Button.js' - via resolveImportSpecifierExtension
  // - import { Button } from './Button' - via require.resolve
  const importPath = isModuleOrAlias ? importSource : resolveImportSpecifierExtension(unresolvedImportPath) || require.resolve(unresolvedImportPath);
  const prefix = importPath.replace(/[^\w_\d]/g, '_');
  const pathInfo = { importPath, isModuleOrAlias };

  const specifierName = specifier.local.name;
  let fullNameSuffix = '';
  let importedNameProperty = '';
  if (componentName !== specifierName) {
    const suffix = componentName.substring(specifierName.length + 1);
    fullNameSuffix = '_' + suffix;
    importedNameProperty = '.' + suffix;
  }

  if (t.isImportDefaultSpecifier(specifier))
    return { fullName: prefix + fullNameSuffix, importedNameProperty, deps: [], ...pathInfo };

  if (t.isIdentifier(specifier.imported))
    return { fullName: prefix + '_' + specifier.imported.name + fullNameSuffix, importedName: specifier.imported.name, importedNameProperty, deps: [], ...pathInfo };
  return { fullName: prefix + '_' + specifier.imported.value + fullNameSuffix, importedName: specifier.imported.value, importedNameProperty, deps: [], ...pathInfo };
}
