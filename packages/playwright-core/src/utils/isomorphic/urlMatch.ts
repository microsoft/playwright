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

import { isString } from './stringUtils';

// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Regular_expressions#escaping
const escapedChars = new Set(['$', '^', '+', '.', '*', '(', ')', '|', '\\', '?', '{', '}', '[', ']']);

export function globToRegexPattern(glob: string): string {
  const tokens = ['^'];
  let inGroup = false;
  for (let i = 0; i < glob.length; ++i) {
    const c = glob[i];
    if (c === '\\' && i + 1 < glob.length) {
      const char = glob[++i];
      tokens.push(escapedChars.has(char) ? '\\' + char : char);
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
        tokens.push(escapedChars.has(c) ? '\\' + c : c);
    }
  }
  tokens.push('$');
  return tokens.join('');
}

function isRegExp(obj: any): obj is RegExp {
  return obj instanceof RegExp || Object.prototype.toString.call(obj) === '[object RegExp]';
}

export type URLMatch = string | RegExp | ((url: URL) => boolean);

export function urlMatchesEqual(match1: URLMatch, match2: URLMatch) {
  if (isRegExp(match1) && isRegExp(match2))
    return match1.source === match2.source && match1.flags === match2.flags;
  return match1 === match2;
}

export function urlMatches(baseURL: string | undefined, urlString: string, match: URLMatch | undefined, webSocketUrl?: boolean): boolean {
  if (match === undefined || match === '')
    return true;
  if (isString(match))
    match = new RegExp(resolveGlobToRegexPattern(baseURL, match, webSocketUrl));
  if (isRegExp(match)) {
    const r = match.test(urlString);
    return r;
  }
  const url = parseURL(urlString);
  if (!url)
    return false;
  if (typeof match !== 'function')
    throw new Error('url parameter should be string, RegExp or function');
  return match(url);
}

export function resolveGlobToRegexPattern(baseURL: string | undefined, glob: string, webSocketUrl?: boolean): string {
  if (webSocketUrl)
    baseURL = toWebSocketBaseUrl(baseURL);
  glob = resolveGlobBase(baseURL, glob);
  return globToRegexPattern(glob);
}

function toWebSocketBaseUrl(baseURL: string | undefined) {
  // Allow http(s) baseURL to match ws(s) urls.
  if (baseURL && /^https?:\/\//.test(baseURL))
    baseURL = baseURL.replace(/^http/, 'ws');
  return baseURL;
}

function resolveGlobBase(baseURL: string | undefined, match: string): string {
  if (!match.startsWith('*')) {
    const tokenMap = new Map<string, string>();
    function mapToken(original: string, replacement: string) {
      if (original.length === 0)
        return '';
      tokenMap.set(replacement, original);
      return replacement;
    }
    // Escaped `\\?` behaves the same as `?` in our glob patterns.
    match = match.replaceAll(/\\\\\?/g, '?');
    // Glob symbols may be escaped in the URL and some of them such as ? affect resolution,
    // so we replace them with safe components first.
    const relativePath = match.split('/').map((token, index) => {
      if (token === '.' || token === '..' || token === '')
        return token;
      // Handle special case of http*://, note that the new schema has to be
      // a web schema so that slashes are properly inserted after domain.
      if (index === 0 && token.endsWith(':'))
        return mapToken(token, 'http:');
      const questionIndex = token.indexOf('?');
      if (questionIndex === -1)
        return mapToken(token, `$_${index}_$`);
      const newPrefix = mapToken(token.substring(0, questionIndex), `$_${index}_$`);
      const newSuffix = mapToken(token.substring(questionIndex), `?$_${index}_$`);
      return newPrefix + newSuffix;
    }).join('/');
    let resolved = constructURLBasedOnBaseURL(baseURL, relativePath);
    for (const [token, original] of tokenMap)
      resolved = resolved.replace(token, original);
    match = resolved;
  }
  return match;
}

function parseURL(url: string): URL | null {
  try {
    return new URL(url);
  } catch (e) {
    return null;
  }
}

export function constructURLBasedOnBaseURL(baseURL: string | undefined, givenURL: string): string {
  try {
    return (new URL(givenURL, baseURL)).toString();
  } catch (e) {
    return givenURL;
  }
}
