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

import { types as t } from '@babel/core';
import { declare } from '@babel/helper-plugin-utils';

export default declare(api => {
  api.assertVersion(7);

  return {
    name: 'playwright-debug-transform',
    visitor: {
      JSXElement(path) {
        const jsxElement = path.node;
        const jsxName = jsxElement.openingElement.name;
        if (!t.isJSXIdentifier(jsxName))
          return;

        const name = jsxName.name;
        const props: (t.ObjectProperty | t.SpreadElement)[] = [];

        for (const jsxAttribute of jsxElement.openingElement.attributes) {
          if (t.isJSXAttribute(jsxAttribute)) {
            if (!t.isJSXIdentifier(jsxAttribute.name))
              continue;
            const attrName = jsxAttribute.name.name;
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

        const children: (t.Expression | t.SpreadElement)[] = [];
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
          t.objectProperty(t.identifier('type'), t.stringLiteral(name)),
          t.objectProperty(t.identifier('props'), t.objectExpression(props)),
          t.objectProperty(t.identifier('children'), t.arrayExpression(children)),
        ]));
      }
    }
  };
});
