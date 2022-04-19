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

import type { NodePath, T, BabelAPI } from './babelBundle';
import { types, declare } from './babelBundle';
const t: typeof T = types;

export default declare((api: BabelAPI) => {
  api.assertVersion(7);

  const result: babel.PluginObj = {
    name: 'playwright-debug-transform',
    visitor: {
      Program(path) {
        path.setData('pw-components', new Map());
      },

      ImportDeclaration(path) {
        // Non-JSX transform, replace
        //   import Button from './ButtonVue.vue'
        //   import { Card as MyCard } from './Card.vue'
        // with
        //   const Button 'Button', MyCard = 'Card';
        const importNode = path.node;
        if (!t.isStringLiteral(importNode.source)) {
          flushConst(path, true);
          return;
        }

        if (!importNode.source.value.endsWith('.vue') && !importNode.source.value.endsWith('.svelte')) {
          flushConst(path, true);
          return;
        }

        const components = path.parentPath.getData('pw-components');
        for (const specifier of importNode.specifiers) {
          if (t.isImportDefaultSpecifier(specifier)) {
            components.set(specifier.local.name, specifier.local.name);
            continue;
          }
          if (t.isImportSpecifier(specifier)) {
            if (t.isIdentifier(specifier.imported))
              components.set(specifier.local.name, specifier.imported.name);
            else
              components.set(specifier.local.name, specifier.imported.value);
          }
        }

        flushConst(path, false);
      },

      JSXElement(path) {
        const jsxElement = path.node;
        const jsxName = jsxElement.openingElement.name;
        if (!t.isJSXIdentifier(jsxName))
          return;

        const name = jsxName.name;
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
          t.objectProperty(t.identifier('type'), t.stringLiteral(name)),
          t.objectProperty(t.identifier('props'), t.objectExpression(props)),
          t.objectProperty(t.identifier('children'), t.arrayExpression(children)),
        ]));
      }
    }
  };
  return result;
});

function flushConst(importPath: NodePath<T.ImportDeclaration>, keepPath: boolean) {
  const importNode = importPath.node;
  const importNodes = (importPath.parentPath.node as T.Program).body.filter(i => t.isImportDeclaration(i));
  const isLast = importNodes.indexOf(importNode) === importNodes.length - 1;
  if (!isLast) {
    if (!keepPath)
      importPath.remove();
    return;
  }

  const components = importPath.parentPath.getData('pw-components');
  if (!components.size)
    return;
  const variables = [];
  for (const [key, value] of components)
    variables.push(t.variableDeclarator(t.identifier(key), t.stringLiteral(value)));
  importPath.skip();
  if (keepPath)
    importPath.replaceWithMultiple([importNode, t.variableDeclaration('const', variables)]);
  else
    importPath.replaceWith(t.variableDeclaration('const', variables));
}
