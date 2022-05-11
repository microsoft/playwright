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
import { getAriaChecked, getAriaDisabled, getAriaExpanded, getAriaLevel, getAriaPressed, getAriaRole, getAriaSelected, getElementAccessibleName, isElementHiddenForAria, kAriaCheckedRoles, kAriaExpandedRoles, kAriaLevelRoles, kAriaPressedRoles, kAriaSelectedRoles } from './roleUtils';
import { parseAttributeSelector, type AttributeSelectorPart, type AttributeSelectorOperator } from '../isomorphic/selectorParser';

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

function validateAttributes(attrs: AttributeSelectorPart[], role: string) {
  for (const attr of attrs) {
    switch (attr.name) {
      case 'checked': {
        validateSupportedRole(attr.name, kAriaCheckedRoles, role);
        validateSupportedValues(attr, [true, false, 'mixed']);
        validateSupportedOp(attr, ['<truthy>', '=']);
        if (attr.op === '<truthy>') {
          // Do not match "mixed" in "option[checked]".
          attr.op = '=';
          attr.value = true;
        }
        break;
      }
      case 'pressed': {
        validateSupportedRole(attr.name, kAriaPressedRoles, role);
        validateSupportedValues(attr, [true, false, 'mixed']);
        validateSupportedOp(attr, ['<truthy>', '=']);
        if (attr.op === '<truthy>') {
          // Do not match "mixed" in "button[pressed]".
          attr.op = '=';
          attr.value = true;
        }
        break;
      }
      case 'selected': {
        validateSupportedRole(attr.name, kAriaSelectedRoles, role);
        validateSupportedValues(attr, [true, false]);
        validateSupportedOp(attr, ['<truthy>', '=']);
        break;
      }
      case 'expanded': {
        validateSupportedRole(attr.name, kAriaExpandedRoles, role);
        validateSupportedValues(attr, [true, false]);
        validateSupportedOp(attr, ['<truthy>', '=']);
        break;
      }
      case 'level': {
        validateSupportedRole(attr.name, kAriaLevelRoles, role);
        // Level is a number, convert it from string.
        if (typeof attr.value === 'string')
          attr.value = +attr.value;
        if (attr.op !== '=' || typeof attr.value !== 'number' || Number.isNaN(attr.value))
          throw new Error(`"level" attribute must be compared to a number`);
        break;
      }
      case 'disabled': {
        validateSupportedValues(attr, [true, false]);
        validateSupportedOp(attr, ['<truthy>', '=']);
        break;
      }
      case 'name': {
        if (attr.op === '<truthy>')
          throw new Error(`"name" attribute must have a value`);
        if (typeof attr.value !== 'string' && !(attr.value instanceof RegExp))
          throw new Error(`"name" attribute must be a string or a regular expression`);
        break;
      }
      case 'include-hidden': {
        validateSupportedValues(attr, [true, false]);
        validateSupportedOp(attr, ['<truthy>', '=']);
        break;
      }
      default: {
        throw new Error(`Unknown attribute "${attr.name}", must be one of ${kSupportedAttributes.map(a => `"${a}"`).join(', ')}.`);
      }
    }
  }
}

export const RoleEngine: SelectorEngine = {
  queryAll(scope: SelectorRoot, selector: string): Element[] {
    const parsed = parseAttributeSelector(selector, true);
    const role = parsed.name.toLowerCase();
    if (!role)
      throw new Error(`Role must not be empty`);
    validateAttributes(parsed.attributes, role);

    const hiddenCache = new Map<Element, boolean>();
    const result: Element[] = [];
    const match = (element: Element) => {
      if (getAriaRole(element) !== role)
        return;
      let includeHidden = false;  // By default, hidden elements are excluded.
      let nameAttr: AttributeSelectorPart | undefined;
      for (const attr of parsed.attributes) {
        if (attr.name === 'include-hidden') {
          includeHidden = attr.op === '<truthy>' || !!attr.value;
          continue;
        }
        if (attr.name === 'name') {
          nameAttr = attr;
          continue;
        }
        let actual;
        switch (attr.name) {
          case 'selected': actual = getAriaSelected(element); break;
          case 'checked': actual = getAriaChecked(element); break;
          case 'pressed': actual = getAriaPressed(element); break;
          case 'expanded': actual = getAriaExpanded(element); break;
          case 'level': actual = getAriaLevel(element); break;
          case 'disabled': actual = getAriaDisabled(element); break;
        }
        if (!matchesAttributePart(actual, attr))
          return;
      }
      if (!includeHidden) {
        const isHidden = isElementHiddenForAria(element, hiddenCache);
        if (isHidden)
          return;
      }
      if (nameAttr !== undefined) {
        const accessibleName = getElementAccessibleName(element, includeHidden, hiddenCache);
        if (!matchesAttributePart(accessibleName, nameAttr))
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
};
