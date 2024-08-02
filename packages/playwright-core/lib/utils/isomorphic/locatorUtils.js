"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.getByAltTextSelector = getByAltTextSelector;
exports.getByLabelSelector = getByLabelSelector;
exports.getByPlaceholderSelector = getByPlaceholderSelector;
exports.getByRoleSelector = getByRoleSelector;
exports.getByTestIdSelector = getByTestIdSelector;
exports.getByTextSelector = getByTextSelector;
exports.getByTitleSelector = getByTitleSelector;
var _stringUtils = require("./stringUtils");
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

function getByAttributeTextSelector(attrName, text, options) {
  return `internal:attr=[${attrName}=${(0, _stringUtils.escapeForAttributeSelector)(text, (options === null || options === void 0 ? void 0 : options.exact) || false)}]`;
}
function getByTestIdSelector(testIdAttributeName, testId) {
  return `internal:testid=[${testIdAttributeName}=${(0, _stringUtils.escapeForAttributeSelector)(testId, true)}]`;
}
function getByLabelSelector(text, options) {
  return 'internal:label=' + (0, _stringUtils.escapeForTextSelector)(text, !!(options !== null && options !== void 0 && options.exact));
}
function getByAltTextSelector(text, options) {
  return getByAttributeTextSelector('alt', text, options);
}
function getByTitleSelector(text, options) {
  return getByAttributeTextSelector('title', text, options);
}
function getByPlaceholderSelector(text, options) {
  return getByAttributeTextSelector('placeholder', text, options);
}
function getByTextSelector(text, options) {
  return 'internal:text=' + (0, _stringUtils.escapeForTextSelector)(text, !!(options !== null && options !== void 0 && options.exact));
}
function getByRoleSelector(role, options = {}) {
  const props = [];
  if (options.checked !== undefined) props.push(['checked', String(options.checked)]);
  if (options.disabled !== undefined) props.push(['disabled', String(options.disabled)]);
  if (options.selected !== undefined) props.push(['selected', String(options.selected)]);
  if (options.expanded !== undefined) props.push(['expanded', String(options.expanded)]);
  if (options.includeHidden !== undefined) props.push(['include-hidden', String(options.includeHidden)]);
  if (options.level !== undefined) props.push(['level', String(options.level)]);
  if (options.name !== undefined) props.push(['name', (0, _stringUtils.escapeForAttributeSelector)(options.name, !!options.exact)]);
  if (options.pressed !== undefined) props.push(['pressed', String(options.pressed)]);
  return `internal:role=${role}${props.map(([n, v]) => `[${n}=${v}]`).join('')}`;
}