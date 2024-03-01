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

import type { SelectorEngine, SelectorRoot } from './selectorEngine';
import { matchesAttributePart } from './selectorUtils';
import { beginAriaCaches, endAriaCaches, getAriaChecked, getAriaDisabled, getAriaExpanded, getAriaLevel, getAriaPressed, getAriaRole, getAriaSelected, getElementAccessibleName, isElementHiddenForAria, kAriaCheckedRoles, kAriaExpandedRoles, kAriaLevelRoles, kAriaPressedRoles, kAriaSelectedRoles } from './roleUtils';
import { parseAttributeSelector, type AttributeSelectorPart, type AttributeSelectorOperator } from '../../utils/isomorphic/selectorParser';
import { normalizeWhiteSpace } from '../../utils/isomorphic/stringUtils';

type RoleEngineOptions = {
  role: string;
  name?: string | RegExp;
  nameOp?: '='|'*='|'|='|'^='|'$='|'~=';
  exact?: boolean;
  checked?: boolean | 'mixed';
  pressed?: boolean | 'mixed';
  selected?: boolean;
  expanded?: boolean;
  level?: number;
  disabled?: boolean;
  includeHidden?: boolean;
};

const kSupportedAttributes = ['selected', 'checked', 'pressed', 'expanded', 'level', 'disabled', 'name', 'include-hidden'];
kSupportedAttributes.sort();

function validateSupportedRole(attr: string, roles: string[], role: string) {
  if (!roles.includes(role))
    throw new Error(`"${attr}" attribute is only supported for roles: ${roles.slice().sort().map(role => `"${role}"`).join(', ')}`);
}

function validateSupportedValues(attr: AttributeSelectorPart, values: any[]) {
  if (attr.op !== '<truthy>' && !values.includes(attr.value))
    throw new Error(`"${attr.name}" must be one of ${values.map(v => JSON.stringify(v)).join(', ')}`);
}

function validateSupportedOp(attr: AttributeSelectorPart, ops: AttributeSelectorOperator[]) {
  if (!ops.includes(attr.op))
    throw new Error(`"${attr.name}" does not support "${attr.op}" matcher`);
}

function validateAttributes(attrs: AttributeSelectorPart[], role: string): RoleEngineOptions {
  const options: RoleEngineOptions = { role };
  for (const attr of attrs) {
    switch (attr.name) {
      case 'checked': {
        validateSupportedRole(attr.name, kAriaCheckedRoles, role);
        validateSupportedValues(attr, [true, false, 'mixed']);
        validateSupportedOp(attr, ['<truthy>', '=']);
        options.checked = attr.op === '<truthy>' ? true : attr.value;
        break;
      }
      case 'pressed': {
        validateSupportedRole(attr.name, kAriaPressedRoles, role);
        validateSupportedValues(attr, [true, false, 'mixed']);
        validateSupportedOp(attr, ['<truthy>', '=']);
        options.pressed = attr.op === '<truthy>' ? true : attr.value;
        break;
      }
      case 'selected': {
        validateSupportedRole(attr.name, kAriaSelectedRoles, role);
        validateSupportedValues(attr, [true, false]);
        validateSupportedOp(attr, ['<truthy>', '=']);
        options.selected = attr.op === '<truthy>' ? true : attr.value;
        break;
      }
      case 'expanded': {
        validateSupportedRole(attr.name, kAriaExpandedRoles, role);
        validateSupportedValues(attr, [true, false]);
        validateSupportedOp(attr, ['<truthy>', '=']);
        options.expanded = attr.op === '<truthy>' ? true : attr.value;
        break;
      }
      case 'level': {
        validateSupportedRole(attr.name, kAriaLevelRoles, role);
        // Level is a number, convert it from string.
        if (typeof attr.value === 'string')
          attr.value = +attr.value;
        if (attr.op !== '=' || typeof attr.value !== 'number' || Number.isNaN(attr.value))
          throw new Error(`"level" attribute must be compared to a number`);
        options.level = attr.value;
        break;
      }
      case 'disabled': {
        validateSupportedValues(attr, [true, false]);
        validateSupportedOp(attr, ['<truthy>', '=']);
        options.disabled = attr.op === '<truthy>' ? true : attr.value;
        break;
      }
      case 'name': {
        if (attr.op === '<truthy>')
          throw new Error(`"name" attribute must have a value`);
        if (typeof attr.value !== 'string' && !(attr.value instanceof RegExp))
          throw new Error(`"name" attribute must be a string or a regular expression`);
        options.name = attr.value;
        options.nameOp = attr.op;
        options.exact = attr.caseSensitive;
        break;
      }
      case 'include-hidden': {
        validateSupportedValues(attr, [true, false]);
        validateSupportedOp(attr, ['<truthy>', '=']);
        options.includeHidden = attr.op === '<truthy>' ? true : attr.value;
        break;
      }
      default: {
        throw new Error(`Unknown attribute "${attr.name}", must be one of ${kSupportedAttributes.map(a => `"${a}"`).join(', ')}.`);
      }
    }
  }
  return options;
}

function queryRole(scope: SelectorRoot, options: RoleEngineOptions, internal: boolean): Element[] {
  const result: Element[] = [];
  const match = (element: Element) => {
    if (getAriaRole(element) !== options.role)
      return;
    if (options.selected !== undefined && getAriaSelected(element) !== options.selected)
      return;
    if (options.checked !== undefined && getAriaChecked(element) !== options.checked)
      return;
    if (options.pressed !== undefined && getAriaPressed(element) !== options.pressed)
      return;
    if (options.expanded !== undefined && getAriaExpanded(element) !== options.expanded)
      return;
    if (options.level !== undefined && getAriaLevel(element) !== options.level)
      return;
    if (options.disabled !== undefined && getAriaDisabled(element) !== options.disabled)
      return;
    if (!options.includeHidden) {
      const isHidden = isElementHiddenForAria(element);
      if (isHidden)
        return;
    }
    if (options.name !== undefined) {
      // Always normalize whitespace in the accessible name.
      const accessibleName = normalizeWhiteSpace(getElementAccessibleName(element, !!options.includeHidden));
      if (typeof options.name === 'string')
        options.name = normalizeWhiteSpace(options.name);
      // internal:role assumes that [name="foo"i] also means substring.
      if (internal && !options.exact && options.nameOp === '=')
        options.nameOp = '*=';
      if (!matchesAttributePart(accessibleName, { name: '', jsonPath: [], op: options.nameOp || '=', value: options.name, caseSensitive: !!options.exact }))
        return;
    }
    result.push(element);
  };

  const query = (root: Element | ShadowRoot | Document) => {
    const shadows: ShadowRoot[] = [];
    if ((root as Element).shadowRoot)
      shadows.push((root as Element).shadowRoot!);
    for (const element of root.querySelectorAll('*')) {
      match(element);
      if (element.shadowRoot)
        shadows.push(element.shadowRoot);
    }
    shadows.forEach(query);
  };

  query(scope);
  return result;
}

export function createRoleEngine(internal: boolean): SelectorEngine {
  return {
    queryAll: (scope: SelectorRoot, selector: string): Element[] => {
      const parsed = parseAttributeSelector(selector, true);
      const role = parsed.name.toLowerCase();
      if (!role)
        throw new Error(`Role must not be empty`);
      const options = validateAttributes(parsed.attributes, role);
      beginAriaCaches();
      try {
        return queryRole(scope, options, internal);
      } finally {
        endAriaCaches();
      }
    }
  };
}
