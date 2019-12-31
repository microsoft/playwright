// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.
import * as accessibility from '../accessibility';
import { WKTargetSession } from './wkConnection';
import { Protocol } from './protocol';

export async function getAccessibilityTree(sesssion: WKTargetSession) {
  const {axNode} = await sesssion.send('Page.accessibilitySnapshot');
  return new WKAXNode(axNode);
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

    async findElement() {
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
      type AXPropertyOfType<Type> = {
        [Key in keyof Protocol.Page.AXNode]:
            Protocol.Page.AXNode[Key] extends Type ? Key : never
      }[keyof Protocol.Page.AXNode];

      const userStringProperties: AXPropertyOfType<string>[] = [
        'value',
        'description',
        'keyshortcuts',
        'roledescription',
        'valuetext'
      ];
      for (const userStringProperty of userStringProperties) {
        if (!(userStringProperty in this._payload))
          continue;
        node[userStringProperty] = this._payload[userStringProperty];
      }

      const booleanProperties: AXPropertyOfType<boolean>[] = [
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
        const value = this._payload[booleanProperty];
        if (!value)
          continue;
        node[booleanProperty] = value;
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
      const numericalProperties: AXPropertyOfType<number>[] = [
        'level',
        'valuemax',
        'valuemin',
      ];
      for (const numericalProperty of numericalProperties) {
        if (!(numericalProperty in this._payload))
          continue;
        node[numericalProperty] = this._payload[numericalProperty];
      }
      const tokenProperties: AXPropertyOfType<string>[] = [
        'autocomplete',
        'haspopup',
        'invalid',
      ];
      for (const tokenProperty of tokenProperties) {
        const value = this._payload[tokenProperty];
        if (!value || value === 'false')
          continue;
        node[tokenProperty] = value;
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
