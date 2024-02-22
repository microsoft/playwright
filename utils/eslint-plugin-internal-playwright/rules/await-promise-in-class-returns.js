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
const { ESLintUtils } = require('@typescript-eslint/utils');
const tsutils = require('ts-api-utils');

module.exports = {
  meta: {
    type: 'problem',
    docs: {
      description: 'ensure that return statements in classes await their promises so we always have the full stack trace in channel owners/tracing apiName extraction',
      category: 'Best Practices',
      recommended: false,
    },
    schema: [],
    fixable: 'code',
  },
  create(context) {
    const parserServices = ESLintUtils.getParserServices(context);
    return {
      'ClassDeclaration MethodDefinition ReturnStatement': function (statement) {
        if (statement.type === 'ReturnStatement' && statement.argument) {
          if (tsutils.isThenableType(
            parserServices.program.getTypeChecker(),
            statement.argument,
            parserServices.getTypeAtLocation(statement.argument)
          )) {
            context.report({
              node: statement,
              message: 'Return statement in a class should await a promise so we are able to extract the whole stack trace when reporting it to e.g. Trace Viewer',
              fix(fixer) {
                const sourceCode = context.getSourceCode();
                const returnKeyword = sourceCode.getFirstToken(statement);
                return fixer.insertTextAfter(returnKeyword, ' await');
              }
            });
          }
        }
      },
    };
  },
};
