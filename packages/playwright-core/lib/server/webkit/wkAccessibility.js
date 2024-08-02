"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.getAccessibilityTree = getAccessibilityTree;
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

async function getAccessibilityTree(session, needle) {
  const objectId = needle ? needle._objectId : undefined;
  const {
    axNode
  } = await session.send('Page.accessibilitySnapshot', {
    objectId
  });
  const tree = new WKAXNode(axNode);
  return {
    tree,
    needle: needle ? tree._findNeedle() : null
  };
}
const WKRoleToARIARole = new Map(Object.entries({
  'TextField': 'textbox'
}));

// WebKit localizes role descriptions on mac, but the english versions only add noise.
const WKUnhelpfulRoleDescriptions = new Map(Object.entries({
  'WebArea': 'HTML content',
  'Summary': 'summary',
  'DescriptionList': 'description list',
  'ImageMap': 'image map',
  'ListMarker': 'list marker',
  'Video': 'video playback',
  'Mark': 'highlighted',
  'contentinfo': 'content information',
  'Details': 'details',
  'DescriptionListDetail': 'description',
  'DescriptionListTerm': 'term',
  'alertdialog': 'web alert dialog',
  'dialog': 'web dialog',
  'status': 'application status',
  'tabpanel': 'tab panel',
  'application': 'web application'
}));
class WKAXNode {
  constructor(payload) {
    this._payload = void 0;
    this._children = void 0;
    this._payload = payload;
    this._children = [];
    for (const payload of this._payload.children || []) this._children.push(new WKAXNode(payload));
  }
  children() {
    return this._children;
  }
  _findNeedle() {
    if (this._payload.found) return this;
    for (const child of this._children) {
      const found = child._findNeedle();
      if (found) return found;
    }
    return null;
  }
  isControl() {
    switch (this._payload.role) {
      case 'button':
      case 'checkbox':
      case 'ColorWell':
      case 'combobox':
      case 'DisclosureTriangle':
      case 'listbox':
      case 'menu':
      case 'menubar':
      case 'menuitem':
      case 'menuitemcheckbox':
      case 'menuitemradio':
      case 'radio':
      case 'scrollbar':
      case 'searchbox':
      case 'slider':
      case 'spinbutton':
      case 'switch':
      case 'tab':
      case 'textbox':
      case 'TextField':
      case 'tree':
        return true;
      default:
        return false;
    }
  }
  _isTextControl() {
    switch (this._payload.role) {
      case 'combobox':
      case 'searchfield':
      case 'textbox':
      case 'TextField':
        return true;
    }
    return false;
  }
  _name() {
    if (this._payload.role === 'text') return this._payload.value || '';
    return this._payload.name || '';
  }
  isInteresting(insideControl) {
    const {
      role,
      focusable
    } = this._payload;
    const name = this._name();
    if (role === 'ScrollArea') return false;
    if (role === 'WebArea') return true;
    if (focusable || role === 'MenuListOption') return true;

    // If it's not focusable but has a control role, then it's interesting.
    if (this.isControl()) return true;

    // A non focusable child of a control is not interesting
    if (insideControl) return false;
    return this.isLeafNode() && !!name;
  }
  _hasRedundantTextChild() {
    if (this._children.length !== 1) return false;
    const child = this._children[0];
    return child._payload.role === 'text' && this._payload.name === child._payload.value;
  }
  isLeafNode() {
    if (!this._children.length) return true;
    // WebKit on Linux ignores everything inside text controls, normalize this behavior
    if (this._isTextControl()) return true;
    // WebKit for mac has text nodes inside heading, li, menuitem, a, and p nodes
    if (this._hasRedundantTextChild()) return true;
    return false;
  }
  serialize() {
    const node = {
      role: WKRoleToARIARole.get(this._payload.role) || this._payload.role,
      name: this._name()
    };
    if ('description' in this._payload && this._payload.description !== node.name) node.description = this._payload.description;
    if ('roledescription' in this._payload) {
      const roledescription = this._payload.roledescription;
      if (roledescription !== this._payload.role && WKUnhelpfulRoleDescriptions.get(this._payload.role) !== roledescription) node.roledescription = roledescription;
    }
    if ('value' in this._payload && this._payload.role !== 'text') {
      if (typeof this._payload.value === 'string') node.valueString = this._payload.value;else if (typeof this._payload.value === 'number') node.valueNumber = this._payload.value;
    }
    if ('checked' in this._payload) node.checked = this._payload.checked === 'true' ? 'checked' : this._payload.checked === 'false' ? 'unchecked' : 'mixed';
    if ('pressed' in this._payload) node.pressed = this._payload.pressed === 'true' ? 'pressed' : this._payload.pressed === 'false' ? 'released' : 'mixed';
    const userStringProperties = ['keyshortcuts', 'valuetext'];
    for (const userStringProperty of userStringProperties) {
      if (!(userStringProperty in this._payload)) continue;
      node[userStringProperty] = this._payload[userStringProperty];
    }
    const booleanProperties = ['disabled', 'expanded', 'focused', 'modal', 'multiselectable', 'readonly', 'required', 'selected'];
    for (const booleanProperty of booleanProperties) {
      // WebArea and ScrollArea treat focus differently than other nodes. They report whether their frame  has focus,
      // not whether focus is specifically on the root node.
      if (booleanProperty === 'focused' && (this._payload.role === 'WebArea' || this._payload.role === 'ScrollArea')) continue;
      const value = this._payload[booleanProperty];
      if (!value) continue;
      node[booleanProperty] = value;
    }
    const numericalProperties = ['level', 'valuemax', 'valuemin'];
    for (const numericalProperty of numericalProperties) {
      if (!(numericalProperty in this._payload)) continue;
      node[numericalProperty] = this._payload[numericalProperty];
    }
    const tokenProperties = ['autocomplete', 'haspopup', 'invalid'];
    for (const tokenProperty of tokenProperties) {
      const value = this._payload[tokenProperty];
      if (!value || value === 'false') continue;
      node[tokenProperty] = value;
    }
    const orientationIsApplicable = new Set(['ScrollArea', 'scrollbar', 'listbox', 'combobox', 'menu', 'tree', 'separator', 'slider', 'tablist', 'toolbar']);
    if (this._payload.orientation && orientationIsApplicable.has(this._payload.role)) node.orientation = this._payload.orientation;
    return node;
  }
}