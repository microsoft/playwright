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

// NOTE: this function should not be used to escape any selectors.
export function escapeWithQuotes(text: string, char: string = '\'') {
  const stringified = JSON.stringify(text);
  const escapedText = stringified.substring(1, stringified.length - 1).replace(/\\"/g, '"');
  if (char === '\'')
    return char + escapedText.replace(/[']/g, '\\\'') + char;
  if (char === '"')
    return char + escapedText.replace(/["]/g, '\\"') + char;
  if (char === '`')
    return char + escapedText.replace(/[`]/g, '`') + char;
  throw new Error('Invalid escape char');
}

export function escapeTemplateString(text: string): string {
  return text
      .replace(/\\/g, '\\\\')
      .replace(/`/g, '\\`')
      .replace(/\$\{/g, '\\${');
}

export function isString(obj: any): obj is string {
  return typeof obj === 'string' || obj instanceof String;
}

export function toTitleCase(name: string) {
  return name.charAt(0).toUpperCase() + name.substring(1);
}

export function toSnakeCase(name: string): string {
  // E.g. ignoreHTTPSErrors => ignore_https_errors.
  return name.replace(/([a-z0-9])([A-Z])/g, '$1_$2').replace(/([A-Z])([A-Z][a-z])/g, '$1_$2').toLowerCase();
}

export function cssEscape(s: string): string {
  let result = '';
  for (let i = 0; i < s.length; i++)
    result += cssEscapeOne(s, i);
  return result;
}

export function quoteCSSAttributeValue(text: string): string {
  return `"${cssEscape(text).replace(/\\ /g, ' ')}"`;
}

function cssEscapeOne(s: string, i: number): string {
  // https://drafts.csswg.org/cssom/#serialize-an-identifier
  const c = s.charCodeAt(i);
  if (c === 0x0000)
    return '\uFFFD';
  if ((c >= 0x0001 && c <= 0x001f) ||
      (c >= 0x0030 && c <= 0x0039 && (i === 0 || (i === 1 && s.charCodeAt(0) === 0x002d))))
    return '\\' + c.toString(16) + ' ';
  if (i === 0 && c === 0x002d && s.length === 1)
    return '\\' + s.charAt(i);
  if (c >= 0x0080 || c === 0x002d || c === 0x005f || (c >= 0x0030 && c <= 0x0039) ||
      (c >= 0x0041 && c <= 0x005a) || (c >= 0x0061 && c <= 0x007a))
    return s.charAt(i);
  return '\\' + s.charAt(i);
}

let normalizedWhitespaceCache: Map<string, string> | undefined;

export function cacheNormalizedWhitespaces() {
  normalizedWhitespaceCache = new Map();
}

export function normalizeWhiteSpace(text: string): string {
  let result = normalizedWhitespaceCache?.get(text);
  if (result === undefined) {
    result = text.replace(/[\u200b\u00ad]/g, '').trim().replace(/\s+/g, ' ');
    normalizedWhitespaceCache?.set(text, result);
  }
  return result;
}

export function normalizeEscapedRegexQuotes(source: string) {
  // This function reverses the effect of escapeRegexForSelector below.
  // Odd number of backslashes followed by the quote -> remove unneeded backslash.
  return source.replace(/(^|[^\\])(\\\\)*\\(['"`])/g, '$1$2$3');
}

function escapeRegexForSelector(re: RegExp): string {
  // Unicode mode does not allow "identity character escapes", so we do not escape and
  // hope that it does not contain quotes and/or >> signs.
  // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Regular_expressions/Character_escape
  // TODO: rework RE usages in internal selectors away from literal representation to json, e.g. {source,flags}.
  if (re.unicode || (re as any).unicodeSets)
    return String(re);
  // Even number of backslashes followed by the quote -> insert a backslash.
  return String(re).replace(/(^|[^\\])(\\\\)*(["'`])/g, '$1$2\\$3').replace(/>>/g, '\\>\\>');
}

export function escapeForTextSelector(text: string | RegExp, exact: boolean): string {
  if (typeof text !== 'string')
    return escapeRegexForSelector(text);
  return `${JSON.stringify(text)}${exact ? 's' : 'i'}`;
}

export function escapeForAttributeSelector(value: string | RegExp, exact: boolean): string {
  if (typeof value !== 'string')
    return escapeRegexForSelector(value);
  // TODO: this should actually be
  //   cssEscape(value).replace(/\\ /g, ' ')
  // However, our attribute selectors do not conform to CSS parsing spec,
  // so we escape them differently.
  return `"${value.replace(/\\/g, '\\\\').replace(/["]/g, '\\"')}"${exact ? 's' : 'i'}`;
}

export function trimString(input: string, cap: number, suffix: string = ''): string {
  if (input.length <= cap)
    return input;
  const chars = [...input];
  if (chars.length > cap)
    return chars.slice(0, cap - suffix.length).join('') + suffix;
  return chars.join('');
}

export function trimStringWithEllipsis(input: string, cap: number): string {
  return trimString(input, cap, '\u2026');
}

export function escapeRegExp(s: string) {
  // From https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Regular_Expressions#escaping
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); // $& means the whole matched string
}

const escaped = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', '\'': '&#39;' };
export function escapeHTMLAttribute(s: string): string {
  return s.replace(/[&<>"']/ug, char => (escaped as any)[char]);
}
export function escapeHTML(s: string): string {
  return s.replace(/[&<]/ug, char => (escaped as any)[char]);
}

export function longestCommonSubstring(s1: string, s2: string): string {
  const n = s1.length;
  const m = s2.length;
  let maxLen = 0;
  let endingIndex = 0;

  // Initialize a 2D array with zeros
  const dp = Array(n + 1)
      .fill(null)
      .map(() => Array(m + 1).fill(0));

  // Build the dp table
  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      if (s1[i - 1] === s2[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;

        if (dp[i][j] > maxLen) {
          maxLen = dp[i][j];
          endingIndex = i;
        }
      }
    }
  }

  // Extract the longest common substring
  return s1.slice(endingIndex - maxLen, endingIndex);
}
