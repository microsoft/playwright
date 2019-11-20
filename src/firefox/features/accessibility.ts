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

interface SerializedAXNode {
  role: string;

  name?: string;
  value?: string|number;
  description?: string;

  keyshortcuts?: string;
  roledescription?: string;
  valuetext?: string;

  disabled?: boolean;
  expanded?: boolean;
  focused?: boolean;
  modal?: boolean;
  multiline?: boolean;
  multiselectable?: boolean;
  readonly?: boolean;
  required?: boolean;
  selected?: boolean;

  checked?: boolean|'mixed';
  pressed?: boolean|'mixed';

  level?: number;

  autocomplete?: string;
  haspopup?: string;
  invalid?: string;
  orientation?: string;

  children?: Array<SerializedAXNode>;
}
export class Accessibility {
  _session: any;
  constructor(session) {
    this._session = session;
  }
  async snapshot(options: { interestingOnly?: boolean; } | undefined = {}): Promise<SerializedAXNode> {
    const { interestingOnly = true } = options;
    const { tree } = await this._session.send('Accessibility.getFullAXTree');
    const root = new AXNode(tree);
    if (!interestingOnly)
      return serializeTree(root)[0];
    const interestingNodes: Set<AXNode> = new Set();
    collectInterestingNodes(interestingNodes, root, false);
    return serializeTree(root, interestingNodes)[0];
  }
}
function collectInterestingNodes(collection: Set<AXNode>, node: AXNode, insideControl: boolean) {
  if (node.isInteresting(insideControl))
    collection.add(node);
  if (node.isLeafNode())
    return;
  insideControl = insideControl || node.isControl();
  for (const child of node._children)
    collectInterestingNodes(collection, child, insideControl);
}
function serializeTree(node: AXNode, whitelistedNodes?: Set<AXNode>): Array<SerializedAXNode> {
  const children: Array<SerializedAXNode> = [];
  for (const child of node._children)
    children.push(...serializeTree(child, whitelistedNodes));
  if (whitelistedNodes && !whitelistedNodes.has(node))
    return children;
  const serializedNode = node.serialize();
  if (children.length)
    serializedNode.children = children;
  return [serializedNode];
}
class AXNode {
  _children: AXNode[];
  private _payload: any;
  private _editable: boolean;
  private _richlyEditable: boolean;
  private _focusable: boolean;
  private _expanded: boolean;
  private _name: string;
  private _role: string;
  private _cachedHasFocusableChild: boolean|undefined;

  constructor(payload) {
    this._payload = payload;
    this._children = (payload.children || []).map(x => new AXNode(x));
    this._editable = payload.editable;
    this._richlyEditable = this._editable && (payload.tag !== 'textarea' && payload.tag !== 'input');
    this._focusable = payload.focusable;
    this._expanded = payload.expanded;
    this._name = this._payload.name;
    this._role = this._payload.role;
    this._cachedHasFocusableChild;
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
    if (this._focusable && this._name)
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

  serialize(): SerializedAXNode {
    const node: {[x in keyof SerializedAXNode]: any} = {
      role: this._role
    };
    const userStringProperties: Array<keyof SerializedAXNode> = [
      'name',
      'value',
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
    const booleanProperties: Array<keyof SerializedAXNode> = [
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
    const tristateProperties: Array<keyof SerializedAXNode> = [
      'checked',
      'pressed',
    ];
    for (const tristateProperty of tristateProperties) {
      if (!(tristateProperty in this._payload))
        continue;
      const value = this._payload[tristateProperty];
      node[tristateProperty] = value;
    }
    const numericalProperties: Array<keyof SerializedAXNode> = [
      'level'
    ];
    for (const numericalProperty of numericalProperties) {
      if (!(numericalProperty in this._payload))
        continue;
      node[numericalProperty] = this._payload[numericalProperty];
    }
    const tokenProperties: Array<keyof SerializedAXNode> = [
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
    return node;
  }
}
