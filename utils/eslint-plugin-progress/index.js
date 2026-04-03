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
 * Unwraps .then()/.catch()/.finally() chains to get the root call.
 */
function unwrapPromiseChain(node) {
  while (node.type === 'CallExpression' &&
         node.callee.type === 'MemberExpression' &&
         node.callee.property.type === 'Identifier' &&
         ['then', 'catch', 'finally'].includes(node.callee.property.name)) {
    node = node.callee.object;
  }
  return node;
}

/**
 * Checks whether a Progress-typed value is passed as first argument to a call,
 * unwrapping any .then/.catch/.finally chains.
 */
function passesProgressAsFirstArg(node, services) {
  const root = unwrapPromiseChain(node);
  if (root.type !== 'CallExpression')
    return false;
  const firstArg = root.arguments[0];
  if (!firstArg)
    return false;
  const checker = services.program.getTypeChecker();
  const tsNode = services.esTreeNodeToTSNodeMap.get(firstArg);
  const type = checker.getTypeAtLocation(tsNode);
  const typeName = type.symbol?.name || type.aliasSymbol?.name || checker.typeToString(type);
  return typeName === 'Progress';
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

        // await progress.anything(...) is always fine — calls on the progress object itself.
        if (awaited.type === 'CallExpression' &&
            awaited.callee.type === 'MemberExpression' &&
            awaited.callee.object.type === 'Identifier' &&
            awaited.callee.object.name === 'progress')
          return;

        // await someCall(progress, ...) is fine.
        if (passesProgressAsFirstArg(awaited, services))
          return;

        // Promise.all/race/allSettled/any are aggregation helpers, not async operations themselves.
        if (awaited.type === 'CallExpression' &&
            awaited.callee.type === 'MemberExpression' &&
            awaited.callee.object.type === 'Identifier' &&
            awaited.callee.object.name === 'Promise' &&
            awaited.callee.property.type === 'Identifier' &&
            ['all', 'race', 'allSettled', 'any'].includes(awaited.callee.property.name))
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
