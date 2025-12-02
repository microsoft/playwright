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

import path from 'path';
import { traverse, babelParse, T, types as t } from './babelBundle';
import type { Location } from '../../types/testReporter';

function containsLocation(range: T.SourceLocation, location: Location): boolean {
  if (location.line < range.start.line || location.line > range.end.line)
    return false;
  if (location.line === range.start.line && location.column < range.start.column)
    return false;
  if (location.line === range.end.line && location.column > range.end.column)
    return false;
  return true;
}

export function findTestEndLocation(text: string, testStartLocation: Location): Location | undefined {
  const ast = babelParse(text, path.basename(testStartLocation.file), false);
  let result: Location | undefined;
  traverse(ast, {
    enter(path) {
      if (t.isCallExpression(path.node) && path.node.loc && containsLocation(path.node.loc, testStartLocation)) {
        const callNode = path.node;
        const funcNode = callNode.arguments[callNode.arguments.length - 1];
        if (callNode.arguments.length >= 2 && t.isFunction(funcNode) && funcNode.body.loc)
          result = { file: testStartLocation.file, ...funcNode.body.loc.end };
      }
    }
  });
  return result;
}
