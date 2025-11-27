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
import { traverse, babelParse, ParseResult, T, types as t } from './babelBundle';
import type { Location } from '../../types/testReporter';

const astCache = new Map<string, { text: string, ast?: ParseResult }>();

export function pruneAstCaches(fsPathsToRetain: string[]) {
  const retain = new Set(fsPathsToRetain);
  for (const key of astCache.keys()) {
    if (!retain.has(key))
      astCache.delete(key);
  }
}

function getAst(text: string, fsPath: string) {
  const cached = astCache.get(fsPath);
  let ast = cached?.ast;
  if (!cached || cached.text !== text) {
    try {
      ast = babelParse(text, path.basename(fsPath), false);
      astCache.set(fsPath, { text, ast });
    } catch (e) {
      astCache.set(fsPath, { text, ast: undefined });
    }
  }
  return ast;
}

function containsPosition(location: T.SourceLocation, position: Location): boolean {
  if (position.line < location.start.line || position.line > location.end.line)
    return false;
  if (position.line === location.start.line && position.column < location.start.column)
    return false;
  if (position.line === location.end.line && position.column > location.end.column)
    return false;
  return true;
}

export function findTestEndPosition(text: string, location: Location): Location | undefined {
  const ast = getAst(text, location.file);
  if (!ast)
    return;
  let result: Location | undefined;
  traverse(ast, {
    enter(path) {
      if (t.isCallExpression(path.node) && path.node.loc && containsPosition(path.node.loc, location)) {
        const callNode = path.node;
        const funcNode = callNode.arguments[callNode.arguments.length - 1];
        if (callNode.arguments.length >= 2 && t.isFunction(funcNode) && funcNode.body.loc)
          result = { file: location.file, ...funcNode.body.loc.end };
      }
    }
  });
  return result;
}
