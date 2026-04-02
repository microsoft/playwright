/**
 * Copyright (c) Microsoft Corporation.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

// @ts-check

const { ESLintUtils } = require('@typescript-eslint/utils');

const createRule = ESLintUtils.RuleCreator(name => name);

/**
 * Checks whether a function parameter named "progress" has type "Progress".
 */
function hasProgressParam(node, services) {
  const checker = services.program.getTypeChecker();
  for (const param of node.params) {
    if (param.type === 'Identifier' && param.name === 'progress') {
      const tsNode = services.esTreeNodeToTSNodeMap.get(param);
      const type = checker.getTypeAtLocation(tsNode);
      if (type.symbol?.name === 'Progress' || type.aliasSymbol?.name === 'Progress')
        return true;
      // Also check the declared type annotation.
      const typeStr = checker.typeToString(type);
      if (typeStr === 'Progress')
        return true;
    }
  }
  return false;
}

/**
 * Checks whether an expression is `progress.race(...)`.
 */
function isProgressRace(node) {
  return (
    node.type === 'CallExpression' &&
    node.callee.type === 'MemberExpression' &&
    node.callee.object.type === 'Identifier' &&
    node.callee.object.name === 'progress' &&
    node.callee.property.type === 'Identifier' &&
    node.callee.property.name === 'race'
  );
}

/**
 * Checks whether `progress` is passed as first argument to a call.
 */
function passesProgressAsFirstArg(node) {
  if (node.type !== 'CallExpression')
    return false;
  const firstArg = node.arguments[0];
  return firstArg?.type === 'Identifier' && firstArg.name === 'progress';
}

/**
 * Checks whether the return type of a call expression is a Promise.
 */
function isAsyncCall(node, services) {
  const checker = services.program.getTypeChecker();
  const tsNode = services.esTreeNodeToTSNodeMap.get(node);
  const type = checker.getTypeAtLocation(tsNode);
  // Check if the type is a Promise (has a "then" method).
  const thenProp = type.getProperty('then');
  return !!thenProp;
}

/**
 * Walks up to find if this expression is inside a progress.race() call.
 */
function isInsideProgressRace(node) {
  let current = node.parent;
  while (current) {
    if (isProgressRace(current))
      return true;
    // Stop at function boundaries.
    if (current.type === 'ArrowFunctionExpression' || current.type === 'FunctionExpression' || current.type === 'FunctionDeclaration' || current.type === 'MethodDefinition')
      return false;
    current = current.parent;
  }
  return false;
}

const rule = createRule({
  name: 'await-must-use-progress',
  meta: {
    type: 'problem',
    docs: {
      description: 'In methods accepting Progress, awaited async calls must pass progress or be wrapped in progress.race()',
    },
    messages: {
      missingProgress: 'Awaited async call must either pass `progress` as first argument or be wrapped in `progress.race()`. See packages/protocol/src/progress.d.ts.',
    },
    schema: [],
  },
  defaultOptions: [],
  create(context) {
    const services = ESLintUtils.getParserServices(context);
    // Stack of functions that have a progress parameter.
    const progressFunctionStack = [];

    function enterFunction(node) {
      progressFunctionStack.push(hasProgressParam(node, services));
    }

    function exitFunction() {
      progressFunctionStack.pop();
    }

    function isInProgressFunction() {
      return progressFunctionStack.length > 0 && progressFunctionStack[progressFunctionStack.length - 1];
    }

    return {
      'FunctionDeclaration': enterFunction,
      'FunctionDeclaration:exit': exitFunction,
      'FunctionExpression': enterFunction,
      'FunctionExpression:exit': exitFunction,
      'ArrowFunctionExpression': enterFunction,
      'ArrowFunctionExpression:exit': exitFunction,

      // Check await expressions in progress functions.
      'AwaitExpression'(node) {
        if (!isInProgressFunction())
          return;

        const awaited = node.argument;

        // await progress.race(...) is always fine.
        if (isProgressRace(awaited))
          return;

        // await someCall(progress, ...) is fine.
        if (passesProgressAsFirstArg(awaited))
          return;

        // Check if this await is inside a progress.race() call higher up.
        if (isInsideProgressRace(node))
          return;

        // Only flag async calls (calls that return Promise).
        if (awaited.type === 'CallExpression' && isAsyncCall(awaited, services)) {
          context.report({
            node: awaited,
            messageId: 'missingProgress',
          });
        }
      },
    };
  },
});

module.exports = {
  rules: {
    'await-must-use-progress': rule,
  },
};
