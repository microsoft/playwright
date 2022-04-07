/**
 * Copyright 2018 Google Inc. All rights reserved.
 * Modifications copyright (c) Microsoft Corporation.
 *
 * Licensed under the Apache License, Version 2.0 (the 'License');
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an 'AS IS' BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import type * as accessibility from '../accessibility';
import type { FFSession } from './ffConnection';
import type { Protocol } from './protocol';
import type * as dom from '../dom';
import type * as types from '../types';

export async function getAccessibilityTree(session: FFSession, needle?: dom.ElementHandle): Promise<{tree: accessibility.AXNode, needle: accessibility.AXNode | null}> {
  const objectId = needle ? needle._objectId : undefined;
  const { tree } = await session.send('Accessibility.getFullAXTree', { objectId });
  const axNode = new FFAXNode(tree);
  return {
    tree: axNode,
    needle: needle ? axNode._findNeedle() : null
  };
}

const FFRoleToARIARole = new Map(Object.entries({
  'pushbutton': 'button',
  'checkbutton': 'checkbox',
  'editcombobox': 'combobox',
  'content deletion': 'deletion',
  'footnote': 'doc-footnote',
  'non-native document': 'document',
  'grouping': 'group',
  'graphic': 'img',
  'content insertion': 'insertion',
  'animation': 'marquee',
  'flat equation': 'math',
  'menupopup': 'menu',
  'check menu item': 'menuitemcheckbox',
  'radio menu item': 'menuitemradio',
  'listbox option': 'option',
  'radiobutton': 'radio',
  'statusbar': 'status',
  'pagetab': 'tab',
  'pagetablist': 'tablist',
  'propertypage': 'tabpanel',
  'entry': 'textbox',
  'outline': 'tree',
  'tree table': 'treegrid',
  'outlineitem': 'treeitem',
}));

class FFAXNode implements accessibility.AXNode {
  _children: FFAXNode[];
  private _payload: Protocol.Accessibility.AXTree;
  private _editable: boolean;
  private _richlyEditable: boolean;
  private _focusable: boolean;
  private _expanded: boolean;
  private _name: string;
  private _role: string;
  private _cachedHasFocusableChild: boolean|undefined;

  constructor(payload: Protocol.Accessibility.AXTree) {
    this._payload = payload;
    this._children = (payload.children || []).map(x => new FFAXNode(x));
    this._editable = !!payload.editable;
    this._richlyEditable = this._editable && (payload.tag !== 'textarea' && payload.tag !== 'input');
    this._focusable = !!payload.focusable;
    this._expanded = !!payload.expanded;
    this._name = this._payload.name;
    this._role = this._payload.role;
  }

  _isPlainTextField(): boolean {
    if (this._richlyEditable)
      return false;
    if (this._editable)
      return true;
    return this._role === 'entry';
  }

  _isTextOnlyObject(): boolean {
    const role = this._role;
    return (role === 'text leaf' || role === 'text' || role === 'statictext');
  }

  _hasFocusableChild(): boolean {
    if (this._cachedHasFocusableChild === undefined) {
      this._cachedHasFocusableChild = false;
      for (const child of this._children) {
        if (child._focusable || child._hasFocusableChild()) {
          this._cachedHasFocusableChild = true;
          break;
        }
      }
    }
    return this._cachedHasFocusableChild;
  }

  children() {
    return this._children;
  }

  _findNeedle(): FFAXNode | null {
    if (this._payload.foundObject)
      return this;
    for (const child of this._children) {
      const found = child._findNeedle();
      if (found)
        return found;
    }
    return null;
  }

  isLeafNode(): boolean {
    if (!this._children.length)
      return true;
      // These types of objects may have children that we use as internal
      // implementation details, but we want to expose them as leaves to platform
      // accessibility APIs because screen readers might be confused if they find
      // any children.
    if (this._isPlainTextField() || this._isTextOnlyObject())
      return true;
      // Roles whose children are only presentational according to the ARIA and
      // HTML5 Specs should be hidden from screen readers.
      // (Note that whilst ARIA buttons can have only presentational children, HTML5
      // buttons are allowed to have content.)
    switch (this._role) {
      case 'graphic':
      case 'scrollbar':
      case 'slider':
      case 'separator':
      case 'progressbar':
        return true;
      default:
        break;
    }
    // Here and below: Android heuristics
    if (this._hasFocusableChild())
      return false;
    if (this._focusable && this._role !== 'document' && this._name)
      return true;
    if (this._role === 'heading' && this._name)
      return true;
    return false;
  }

  isControl(): boolean {
    switch (this._role) {
      case 'checkbutton':
      case 'check menu item':
      case 'check rich option':
      case 'combobox':
      case 'combobox option':
      case 'color chooser':
      case 'listbox':
      case 'listbox option':
      case 'listbox rich option':
      case 'popup menu':
      case 'menupopup':
      case 'menuitem':
      case 'menubar':
      case 'button':
      case 'pushbutton':
      case 'radiobutton':
      case 'radio menuitem':
      case 'scrollbar':
      case 'slider':
      case 'spinbutton':
      case 'switch':
      case 'pagetab':
      case 'entry':
      case 'tree table':
        return true;
      default:
        return false;
    }
  }

  isInteresting(insideControl: boolean): boolean {
    if (this._focusable || this._richlyEditable)
      return true;
      // If it's not focusable but has a control role, then it's interesting.
    if (this.isControl())
      return true;
      // A non focusable child of a control is not interesting
    if (insideControl)
      return false;
    return this.isLeafNode() && !!this._name.trim();
  }

  serialize(): types.SerializedAXNode {
    const node: {[x in keyof types.SerializedAXNode]: any} = {
      role: FFRoleToARIARole.get(this._role) || this._role,
      name: this._name || '',
    };
    const userStringProperties: Array<keyof types.SerializedAXNode & keyof Protocol.Accessibility.AXTree> = [
      'name',
      'description',
      'roledescription',
      'valuetext',
      'keyshortcuts',
    ];
    for (const userStringProperty of userStringProperties) {
      if (!(userStringProperty in this._payload))
        continue;
      node[userStringProperty] = this._payload[userStringProperty];
    }
    const booleanProperties: Array<keyof types.SerializedAXNode & keyof Protocol.Accessibility.AXTree> = [
      'disabled',
      'expanded',
      'focused',
      'modal',
      'multiline',
      'multiselectable',
      'readonly',
      'required',
      'selected',
    ];
    for (const booleanProperty of booleanProperties) {
      if (this._role === 'document' && booleanProperty === 'focused')
        continue; // document focusing is strange
      const value = this._payload[booleanProperty];
      if (!value)
        continue;
      node[booleanProperty] = value;
    }
    const numericalProperties: Array<keyof types.SerializedAXNode & keyof Protocol.Accessibility.AXTree> = [
      'level'
    ];
    for (const numericalProperty of numericalProperties) {
      if (!(numericalProperty in this._payload))
        continue;
      node[numericalProperty] = this._payload[numericalProperty];
    }
    const tokenProperties: Array<keyof types.SerializedAXNode & keyof Protocol.Accessibility.AXTree> = [
      'autocomplete',
      'haspopup',
      'invalid',
      'orientation',
    ];
    for (const tokenProperty of tokenProperties) {
      const value = this._payload[tokenProperty];
      if (!value || value === 'false')
        continue;
      node[tokenProperty] = value;
    }

    const axNode = node as types.SerializedAXNode;
    axNode.valueString = this._payload.value;
    if ('checked' in this._payload)
      axNode.checked = this._payload.checked === true ? 'checked' : this._payload.checked === 'mixed' ? 'mixed' : 'unchecked';
    if ('pressed' in this._payload)
      axNode.pressed = this._payload.pressed === true ? 'pressed' : 'released';
    return axNode;
  }
}
