"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.cssEscape = cssEscape;
exports.escapeForAttributeSelector = escapeForAttributeSelector;
exports.escapeForTextSelector = escapeForTextSelector;
exports.escapeRegExp = escapeRegExp;
exports.escapeWithQuotes = escapeWithQuotes;
exports.isString = isString;
exports.normalizeEscapedRegexQuotes = normalizeEscapedRegexQuotes;
exports.normalizeWhiteSpace = normalizeWhiteSpace;
exports.quoteCSSAttributeValue = quoteCSSAttributeValue;
exports.toSnakeCase = toSnakeCase;
exports.toTitleCase = toTitleCase;
exports.trimString = trimString;
exports.trimStringWithEllipsis = trimStringWithEllipsis;
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
function escapeWithQuotes(text, char = '\'') {
  const stringified = JSON.stringify(text);
  const escapedText = stringified.substring(1, stringified.length - 1).replace(/\\"/g, '"');
  if (char === '\'') return char + escapedText.replace(/[']/g, '\\\'') + char;
  if (char === '"') return char + escapedText.replace(/["]/g, '\\"') + char;
  if (char === '`') return char + escapedText.replace(/[`]/g, '`') + char;
  throw new Error('Invalid escape char');
}
function isString(obj) {
  return typeof obj === 'string' || obj instanceof String;
}
function toTitleCase(name) {
  return name.charAt(0).toUpperCase() + name.substring(1);
}
function toSnakeCase(name) {
  // E.g. ignoreHTTPSErrors => ignore_https_errors.
  return name.replace(/([a-z0-9])([A-Z])/g, '$1_$2').replace(/([A-Z])([A-Z][a-z])/g, '$1_$2').toLowerCase();
}
function cssEscape(s) {
  let result = '';
  for (let i = 0; i < s.length; i++) result += cssEscapeOne(s, i);
  return result;
}
function quoteCSSAttributeValue(text) {
  return `"${cssEscape(text).replace(/\\ /g, ' ')}"`;
}
function cssEscapeOne(s, i) {
  // https://drafts.csswg.org/cssom/#serialize-an-identifier
  const c = s.charCodeAt(i);
  if (c === 0x0000) return '\uFFFD';
  if (c >= 0x0001 && c <= 0x001f || c >= 0x0030 && c <= 0x0039 && (i === 0 || i === 1 && s.charCodeAt(0) === 0x002d)) return '\\' + c.toString(16) + ' ';
  if (i === 0 && c === 0x002d && s.length === 1) return '\\' + s.charAt(i);
  if (c >= 0x0080 || c === 0x002d || c === 0x005f || c >= 0x0030 && c <= 0x0039 || c >= 0x0041 && c <= 0x005a || c >= 0x0061 && c <= 0x007a) return s.charAt(i);
  return '\\' + s.charAt(i);
}
function normalizeWhiteSpace(text) {
  return text.replace(/\u200b/g, '').trim().replace(/\s+/g, ' ');
}
function normalizeEscapedRegexQuotes(source) {
  // This function reverses the effect of escapeRegexForSelector below.
  // Odd number of backslashes followed by the quote -> remove unneeded backslash.
  return source.replace(/(^|[^\\])(\\\\)*\\(['"`])/g, '$1$2$3');
}
function escapeRegexForSelector(re) {
  // Unicode mode does not allow "identity character escapes", so we do not escape and
  // hope that it does not contain quotes and/or >> signs.
  // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Regular_expressions/Character_escape
  // TODO: rework RE usages in internal selectors away from literal representation to json, e.g. {source,flags}.
  if (re.unicode || re.unicodeSets) return String(re);
  // Even number of backslashes followed by the quote -> insert a backslash.
  return String(re).replace(/(^|[^\\])(\\\\)*(["'`])/g, '$1$2\\$3').replace(/>>/g, '\\>\\>');
}
function escapeForTextSelector(text, exact) {
  if (typeof text !== 'string') return escapeRegexForSelector(text);
  return `${JSON.stringify(text)}${exact ? 's' : 'i'}`;
}
function escapeForAttributeSelector(value, exact) {
  if (typeof value !== 'string') return escapeRegexForSelector(value);
  // TODO: this should actually be
  //   cssEscape(value).replace(/\\ /g, ' ')
  // However, our attribute selectors do not conform to CSS parsing spec,
  // so we escape them differently.
  return `"${value.replace(/\\/g, '\\\\').replace(/["]/g, '\\"')}"${exact ? 's' : 'i'}`;
}
function trimString(input, cap, suffix = '') {
  if (input.length <= cap) return input;
  const chars = [...input];
  if (chars.length > cap) return chars.slice(0, cap - suffix.length).join('') + suffix;
  return chars.join('');
}
function trimStringWithEllipsis(input, cap) {
  return trimString(input, cap, '\u2026');
}
function escapeRegExp(s) {
  // From https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Regular_Expressions#escaping
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); // $& means the whole matched string
}