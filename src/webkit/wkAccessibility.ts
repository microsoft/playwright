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
import * as accessibility from '../accessibility';
import { WKSession } from './wkConnection';
import { Protocol } from './protocol';
import * as dom from '../dom';

export async function getAccessibilityTree(session: WKSession, needle?: dom.ElementHandle) {
  const objectId = needle ? needle._remoteObject.objectId : undefined;
  const {axNode} = await session.send('Page.accessibilitySnapshot', { objectId });
  const tree = new WKAXNode(axNode);
  return {
    tree,
    needle: needle && tree._findNeedle()
  };
}

class WKAXNode implements accessibility.AXNode {
    private _payload: Protocol.Page.AXNode;
    private _children: WKAXNode[];

    constructor(payload : Protocol.Page.AXNode) {
      this._payload = payload;

      this._children = [];
      for (const payload of this._payload.children || [])
        this._children.push(new WKAXNode(payload));
    }

    children() {
      return this._children;
    }

    _findNeedle() : WKAXNode {
      if (this._payload.found)
        return this;
      for (const child of this._children) {
        const found = child._findNeedle()
        if (found)
          return found;
      }
      return null;
    }

    isControl() : boolean {
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

    isInteresting(insideControl: boolean) : boolean {
      const {role, focusable, name} = this._payload;
      if (role === 'ScrollArea')
        return false;
      if (role === 'WebArea')
        return true;

      if (focusable || role === 'MenuListOption')
        return true;

      // If it's not focusable but has a control role, then it's interesting.
      if (this.isControl())
        return true;

      // A non focusable child of a control is not interesting
      if (insideControl)
        return false;

      return this.isLeafNode() && !!name;
    }

    isLeafNode() : boolean {
      return !this._children.length;
    }

    serialize(): accessibility.SerializedAXNode {
      const node : accessibility.SerializedAXNode = {
        role: this._payload.role,
        name: this._payload.name || '',
      };

      const userStringProperties: string[] = [
        'value',
        'description',
        'keyshortcuts',
        'roledescription',
        'valuetext'
      ];
      for (const userStringProperty of userStringProperties) {
        if (!(userStringProperty in this._payload))
          continue;
        (node as any)[userStringProperty] = (this._payload as any)[userStringProperty];
      }

      const booleanProperties: string[] = [
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
        // WebArea and ScorllArea treat focus differently than other nodes. They report whether their frame  has focus,
        // not whether focus is specifically on the root node.
        if (booleanProperty === 'focused' && (this._payload.role === 'WebArea' || this._payload.role === 'ScrollArea'))
          continue;
        const value = (this._payload as any)[booleanProperty];
        if (!value)
          continue;
        (node as any)[booleanProperty] = value;
      }

      const tristateProperties: ('checked'|'pressed')[] = [
        'checked',
        'pressed',
      ];
      for (const tristateProperty of tristateProperties) {
        if (!(tristateProperty in this._payload))
          continue;
        const value = this._payload[tristateProperty];
        node[tristateProperty] = value === 'mixed' ? 'mixed' : value === 'true' ? true : false;
      }
      const numericalProperties: string[] = [
        'level',
        'valuemax',
        'valuemin',
      ];
      for (const numericalProperty of numericalProperties) {
        if (!(numericalProperty in this._payload))
          continue;
        (node as any)[numericalProperty] = (this._payload as any)[numericalProperty];
      }
      const tokenProperties: string[] = [
        'autocomplete',
        'haspopup',
        'invalid',
      ];
      for (const tokenProperty of tokenProperties) {
        const value = (this._payload as any)[tokenProperty];
        if (!value || value === 'false')
          continue;
        (node as any)[tokenProperty] = value;
      }

      const orientationIsApplicable = new Set([
        'ScrollArea',
        'scrollbar',
        'listbox',
        'combobox',
        'menu',
        'tree',
        'separator',
        'slider',
        'tablist',
        'toolbar',
      ]);
      if (this._payload.orientation && orientationIsApplicable.has(this._payload.role))
        node.orientation = this._payload.orientation;

      return node;
    }
}
