/**
 * Copyright 2017 Google Inc. All rights reserved.
 * Modifications copyright (c) Microsoft Corporation.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import type * as types from './types';
import fs from 'fs';
import { isString, isRegExp, constructURLBasedOnBaseURL } from '../utils';

export function envObjectToArray(env: types.Env): { name: string, value: string }[] {
  const result: { name: string, value: string }[] = [];
  for (const name in env) {
    if (!Object.is(env[name], undefined))
      result.push({ name, value: String(env[name]) });
  }
  return result;
}

export async function evaluationScript(fun: Function | string | { path?: string, content?: string }, arg?: any, addSourceUrl: boolean = true): Promise<string> {
  if (typeof fun === 'function') {
    const source = fun.toString();
    const argString = Object.is(arg, undefined) ? 'undefined' : JSON.stringify(arg);
    return `(${source})(${argString})`;
  }
  if (arg !== undefined)
    throw new Error('Cannot evaluate a string with arguments');
  if (isString(fun))
    return fun;
  if (fun.content !== undefined)
    return fun.content;
  if (fun.path !== undefined) {
    let source = await fs.promises.readFile(fun.path, 'utf8');
    if (addSourceUrl)
      source += '\n//# sourceURL=' + fun.path.replace(/\n/g, '');
    return source;
  }
  throw new Error('Either path or content property must be present');
}

export function parsedURL(url: string): URL | null {
  try {
    return new URL(url);
  } catch (e) {
    return null;
  }
}

export function urlMatches(baseURL: string | undefined, urlString: string, match: types.URLMatch | undefined): boolean {
  if (match === undefined || match === '')
    return true;
  if (isString(match) && !match.startsWith('*'))
    match = constructURLBasedOnBaseURL(baseURL, match);
  if (isString(match))
    match = globToRegex(match);
  if (isRegExp(match))
    return match.test(urlString);
  if (typeof match === 'string' && match === urlString)
    return true;
  const url = parsedURL(urlString);
  if (!url)
    return false;
  if (typeof match === 'string')
    return url.pathname === match;
  if (typeof match !== 'function')
    throw new Error('url parameter should be string, RegExp or function');
  return match(url);
}

const escapeGlobChars = new Set(['/', '$', '^', '+', '.', '(', ')', '=', '!', '|']);

export function globToRegex(glob: string): RegExp {
  const tokens = ['^'];
  let inGroup;
  for (let i = 0; i < glob.length; ++i) {
    const c = glob[i];
    if (escapeGlobChars.has(c)) {
      tokens.push('\\' + c);
      continue;
    }
    if (c === '*') {
      const beforeDeep = glob[i - 1];
      let starCount = 1;
      while (glob[i + 1] === '*') {
        starCount++;
        i++;
      }
      const afterDeep = glob[i + 1];
      const isDeep = starCount > 1 &&
          (beforeDeep === '/' || beforeDeep === undefined) &&
          (afterDeep === '/' || afterDeep === undefined);
      if (isDeep) {
        tokens.push('((?:[^/]*(?:\/|$))*)');
        i++;
      } else {
        tokens.push('([^/]*)');
      }
      continue;
    }

    switch (c) {
      case '?':
        tokens.push('.');
        break;
      case '{':
        inGroup = true;
        tokens.push('(');
        break;
      case '}':
        inGroup = false;
        tokens.push(')');
        break;
      case ',':
        if (inGroup) {
          tokens.push('|');
          break;
        }
        tokens.push('\\' + c);
        break;
      default:
        tokens.push(c);
    }
  }
  tokens.push('$');
  return new RegExp(tokens.join(''));
}
