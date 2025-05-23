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

import type { CRSession } from './crConnection';
import type { Protocol } from './protocol';
import type * as accessibility from '../accessibility';
import type * as dom from '../dom';
import type * as channels from '@protocol/channels';

export async function getAccessibilityTree(client: CRSession, needle?: dom.ElementHandle): Promise<{tree: accessibility.AXNode, needle: accessibility.AXNode | null}> {
  const { nodes } = await client.send('Accessibility.getFullAXTree');
  const tree = CRAXNode.createTree(client, nodes);
  return {
    tree,
    needle: needle ? await tree._findElement(needle) : null
  };
}

class CRAXNode implements accessibility.AXNode {
  _payload: Protocol.Accessibility.AXNode;
  _children: CRAXNode[] = [];
  private _richlyEditable = false;
  private _editable = false;
  private _focusable = false;
  private _expanded = false;
  private _hidden = false;
  private _name: string;
  private _role: string;
  private _cachedHasFocusableChild: boolean | undefined;
  private _client: CRSession;

  constructor(client: CRSession, payload: Protocol.Accessibility.AXNode) {
    this._client = client;
    this._payload = payload;

    this._name = this._payload.name ? this._payload.name.value : '';
    this._role = this._payload.role ? this._payload.role.value : 'Unknown';

    for (const property of this._payload.properties || []) {
      if (property.name === 'editable') {
        this._richlyEditable = property.value.value === 'richtext';
        this._editable = true;
      }
      if (property.name === 'focusable')
        this._focusable = property.value.value;
      if (property.name === 'expanded')
        this._expanded = property.value.value;
      if (property.name === 'hidden')
        this._hidden = property.value.value;
    }
  }

  private _isPlainTextField(): boolean {
    if (this._richlyEditable)
      return false;
    if (this._editable)
      return true;
    return this._role === 'textbox' || this._role === 'ComboBox' || this._role === 'searchbox';
  }

  private _isTextOnlyObject(): boolean {
    const role = this._role;
    return (role === 'LineBreak' || role === 'text' ||
            role === 'InlineTextBox' || role === 'StaticText');
  }

  private _hasFocusableChild(): boolean {
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

  async _findElement(element: dom.ElementHandle): Promise<CRAXNode | null> {
    const objectId = element._objectId;
    const { node: { backendNodeId } } = await this._client.send('DOM.describeNode', { objectId });
    const needle = this.find(node => node._payload.backendDOMNodeId === backendNodeId);
    return needle || null;
  }

  find(predicate: (arg0: CRAXNode) => boolean): CRAXNode | null {
    if (predicate(this))
      return this;
    for (const child of this._children) {
      const result = child.find(predicate);
      if (result)
        return result;
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
      case 'doc-cover':
      case 'graphics-symbol':
      case 'img':
      case 'Meter':
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
    if (this._focusable && this._role !== 'WebArea' && this._role !== 'RootWebArea' && this._name)
      return true;
    if (this._role === 'heading' && this._name)
      return true;
    return false;
  }

  isControl(): boolean {
    switch (this._role) {
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
      case 'tree':
        return true;
      default:
        return false;
    }
  }

  isInteresting(insideControl: boolean): boolean {
    const role = this._role;
    if (role === 'Ignored' || this._hidden)
      return false;

    if (this._focusable || this._richlyEditable)
      return true;

    // If it's not focusable but has a control role, then it's interesting.
    if (this.isControl())
      return true;

    // A non focusable child of a control is not interesting
    if (insideControl)
      return false;

    return this.isLeafNode() && !!this._name;
  }

  normalizedRole() {
    switch (this._role) {
      case 'RootWebArea':
        return 'WebArea';
      case 'StaticText':
        return 'text';
      default:
        return this._role;
    }
  }

  serialize(): channels.AXNode {
    const properties: Map<string, number | string | boolean> = new Map();
    for (const property of this._payload.properties || [])
      properties.set(property.name.toLowerCase(), property.value.value);
    if (this._payload.description)
      properties.set('description', this._payload.description.value);

    const node: {[x in keyof channels.AXNode]: any} = {
      role: this.normalizedRole(),
      name: this._payload.name ? (this._payload.name.value || '') : '',
    };

    const userStringProperties: Array<keyof channels.AXNode> = [
      'description',
      'keyshortcuts',
      'roledescription',
      'valuetext',
    ];
    for (const userStringProperty of userStringProperties) {
      if (!properties.has(userStringProperty))
        continue;
      node[userStringProperty] = properties.get(userStringProperty);
    }
    const booleanProperties: Array<keyof channels.AXNode> = [
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
      // WebArea's treat focus differently than other nodes. They report whether their frame  has focus,
      // not whether focus is specifically on the root node.
      if (booleanProperty === 'focused' && (this._role === 'WebArea' || this._role === 'RootWebArea'))
        continue;
      const value = properties.get(booleanProperty);
      if (!value)
        continue;
      node[booleanProperty] = value;
    }
    const numericalProperties: Array<keyof channels.AXNode> = [
      'level',
      'valuemax',
      'valuemin',
    ];
    for (const numericalProperty of numericalProperties) {
      if (!properties.has(numericalProperty))
        continue;
      node[numericalProperty] = properties.get(numericalProperty);
    }
    const tokenProperties: Array<keyof channels.AXNode> = [
      'autocomplete',
      'haspopup',
      'invalid',
      'orientation',
    ];
    for (const tokenProperty of tokenProperties) {
      const value = properties.get(tokenProperty);
      if (!value || value === 'false')
        continue;
      node[tokenProperty] = value;
    }

    const axNode = node as channels.AXNode;
    if (this._payload.value) {
      if (typeof this._payload.value.value === 'string')
        axNode.valueString = this._payload.value.value;
      if (typeof this._payload.value.value === 'number')
        axNode.valueNumber = this._payload.value.value;
    }
    if (properties.has('checked'))
      axNode.checked = properties.get('checked') === 'true' ? 'checked' : properties.get('checked') === 'false' ? 'unchecked' : 'mixed';
    if (properties.has('pressed'))
      axNode.pressed = properties.get('pressed') === 'true' ? 'pressed' : properties.get('pressed') === 'false' ? 'released' : 'mixed';
    return axNode;
  }

  static createTree(client: CRSession, payloads: Protocol.Accessibility.AXNode[]): CRAXNode {
    const nodeById: Map<string, CRAXNode> = new Map();
    for (const payload of payloads)
      nodeById.set(payload.nodeId, new CRAXNode(client, payload));
    for (const node of nodeById.values()) {
      for (const childId of node._payload.childIds || [])
        node._children.push(nodeById.get(childId)!);
    }
    return nodeById.values().next().value!;
  }
}
