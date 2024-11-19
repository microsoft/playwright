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

// https://www.w3.org/TR/wai-aria-1.2/#role_definitions

export type AriaRole = 'alert' | 'alertdialog' | 'application' | 'article' | 'banner' | 'blockquote' | 'button' | 'caption' | 'cell' | 'checkbox' | 'code' | 'columnheader' | 'combobox' |
  'complementary' | 'contentinfo' | 'definition' | 'deletion' | 'dialog' | 'directory' | 'document' | 'emphasis' | 'feed' | 'figure' | 'form' | 'generic' | 'grid' |
  'gridcell' | 'group' | 'heading' | 'img' | 'insertion' | 'link' | 'list' | 'listbox' | 'listitem' | 'log' | 'main' | 'mark' | 'marquee' | 'math' | 'meter' | 'menu' |
  'menubar' | 'menuitem' | 'menuitemcheckbox' | 'menuitemradio' | 'navigation' | 'none' | 'note' | 'option' | 'paragraph' | 'presentation' | 'progressbar' | 'radio' | 'radiogroup' |
  'region' | 'row' | 'rowgroup' | 'rowheader' | 'scrollbar' | 'search' | 'searchbox' | 'separator' | 'slider' |
  'spinbutton' | 'status' | 'strong' | 'subscript' | 'superscript' | 'switch' | 'tab' | 'table' | 'tablist' | 'tabpanel' | 'term' | 'textbox' | 'time' | 'timer' |
  'toolbar' | 'tooltip' | 'tree' | 'treegrid' | 'treeitem';

export type ParsedYaml = Array<any>;

export type AriaProps = {
  checked?: boolean | 'mixed';
  disabled?: boolean;
  expanded?: boolean;
  level?: number;
  pressed?: boolean | 'mixed';
  selected?: boolean;
};

export type AriaTemplateTextNode = {
  kind: 'text';
  text: RegExp | string;
};

export type AriaTemplateRoleNode = AriaProps & {
  kind: 'role';
  role: AriaRole | 'fragment';
  name?: RegExp | string;
  children?: AriaTemplateNode[];
};

export type AriaTemplateNode = AriaTemplateRoleNode | AriaTemplateTextNode;

export function parseYamlTemplate(fragment: ParsedYaml): AriaTemplateNode {
  const result: AriaTemplateNode = { kind: 'role', role: 'fragment' };
  populateNode(result, fragment);
  if (result.children && result.children.length === 1)
    return result.children[0];
  return result;
}

function populateNode(node: AriaTemplateRoleNode, container: ParsedYaml) {
  for (const object of container) {
    if (typeof object === 'string') {
      const childNode = KeyParser.parse(object);
      node.children = node.children || [];
      node.children.push(childNode);
      continue;
    }

    for (const key of Object.keys(object)) {
      node.children = node.children || [];
      const value = object[key];

      if (key === 'text') {
        node.children.push({
          kind: 'text',
          text: valueOrRegex(value)
        });
        continue;
      }

      const childNode = KeyParser.parse(key);
      if (childNode.kind === 'text') {
        node.children.push({
          kind: 'text',
          text: valueOrRegex(value)
        });
        continue;
      }

      if (typeof value === 'string') {
        node.children.push({
          ...childNode, children: [{
            kind: 'text',
            text: valueOrRegex(value)
          }]
        });
        continue;
      }

      node.children.push(childNode);
      populateNode(childNode, value);
    }
  }
}

function normalizeWhitespace(text: string) {
  return text.replace(/[\r\n\s\t]+/g, ' ').trim();
}

function valueOrRegex(value: string): string | RegExp {
  return value.startsWith('/') && value.endsWith('/') ? new RegExp(value.slice(1, -1)) : normalizeWhitespace(value);
}

class KeyParser {
  private _input: string;
  private _pos: number;
  private _length: number;

  static parse(input: string): AriaTemplateNode {
    return new KeyParser(input)._parse();
  }

  constructor(input: string) {
    this._input = input;
    this._pos = 0;
    this._length = input.length;
  }

  private _peek() {
    return this._input[this._pos] || '';
  }

  private _next() {
    if (this._pos < this._length)
      return this._input[this._pos++];
    return null;
  }

  private _eof() {
    return this._pos >= this._length;
  }

  private _isWhitespace() {
    return !this._eof() && /\s/.test(this._peek());
  }

  private _skipWhitespace() {
    while (this._isWhitespace())
      this._pos++;
  }

  private _readIdentifier(type: 'role' | 'attribute'): string {
    if (this._eof())
      this._throwError(`Unexpected end of input when expecting ${type}`);
    const start = this._pos;
    while (!this._eof() && /[a-zA-Z]/.test(this._peek()))
      this._pos++;
    return this._input.slice(start, this._pos);
  }

  private _readString(): string {
    let result = '';
    let escaped = false;
    while (!this._eof()) {
      const ch = this._next();
      if (escaped) {
        result += ch;
        escaped = false;
      } else if (ch === '\\') {
        escaped = true;
      } else if (ch === '"') {
        return result;
      } else {
        result += ch;
      }
    }
    this._throwError('Unterminated string');
  }

  private _throwError(message: string, pos?: number): never {
    throw new AriaKeyError(message, this._input, pos || this._pos);
  }

  private _readRegex(): string {
    let result = '';
    let escaped = false;
    let insideClass = false;
    while (!this._eof()) {
      const ch = this._next();
      if (escaped) {
        result += ch;
        escaped = false;
      } else if (ch === '\\') {
        escaped = true;
        result += ch;
      } else if (ch === '/' && !insideClass) {
        return result;
      } else if (ch === '[') {
        insideClass = true;
        result += ch;
      } else if (ch === ']' && insideClass) {
        result += ch;
        insideClass = false;
      } else {
        result += ch;
      }
    }
    this._throwError('Unterminated regex');
  }

  private _readStringOrRegex(): string | RegExp | null {
    const ch = this._peek();
    if (ch === '"') {
      this._next();
      return this._readString();
    }

    if (ch === '/') {
      this._next();
      return new RegExp(this._readRegex());
    }

    return null;
  }

  private _readAttributes(result: AriaTemplateRoleNode) {
    let errorPos = this._pos;
    while (true) {
      this._skipWhitespace();
      if (this._peek() === '[') {
        this._next();
        this._skipWhitespace();
        errorPos = this._pos;
        const flagName = this._readIdentifier('attribute');
        this._skipWhitespace();
        let flagValue = '';
        if (this._peek() === '=') {
          this._next();
          this._skipWhitespace();
          errorPos = this._pos;
          while (this._peek() !== ']' && !this._isWhitespace() && !this._eof())
            flagValue += this._next();
        }
        this._skipWhitespace();
        if (this._peek() !== ']')
          this._throwError('Expected ]');

        this._next(); // Consume ']'
        this._applyAttribute(result, flagName, flagValue || 'true', errorPos);
      } else {
        break;
      }
    }
  }

  _parse(): AriaTemplateNode {
    this._skipWhitespace();

    const role = this._readIdentifier('role') as AriaTemplateRoleNode['role'];
    this._skipWhitespace();
    const name = this._readStringOrRegex() || '';
    const result: AriaTemplateRoleNode = { kind: 'role', role, name };
    this._readAttributes(result);
    this._skipWhitespace();
    if (!this._eof())
      this._throwError('Unexpected input');
    return result;
  }

  private _applyAttribute(node: AriaTemplateRoleNode, key: string, value: string, errorPos: number) {
    if (key === 'checked') {
      this._assert(value === 'true' || value === 'false' || value === 'mixed', 'Value of "checked\" attribute must be a boolean or "mixed"', errorPos);
      node.checked = value === 'true' ? true : value === 'false' ? false : 'mixed';
      return;
    }
    if (key === 'disabled') {
      this._assert(value === 'true' || value === 'false', 'Value of "disabled" attribute must be a boolean', errorPos);
      node.disabled = value === 'true';
      return;
    }
    if (key === 'expanded') {
      this._assert(value === 'true' || value === 'false', 'Value of "expanded" attribute must be a boolean', errorPos);
      node.expanded = value === 'true';
      return;
    }
    if (key === 'level') {
      this._assert(!isNaN(Number(value)), 'Value of "level" attribute must be a number', errorPos);
      node.level = Number(value);
      return;
    }
    if (key === 'pressed') {
      this._assert(value === 'true' || value === 'false' || value === 'mixed', 'Value of "pressed" attribute must be a boolean or "mixed"', errorPos);
      node.pressed = value === 'true' ? true : value === 'false' ? false : 'mixed';
      return;
    }
    if (key === 'selected') {
      this._assert(value === 'true' || value === 'false', 'Value of "selected" attribute must be a boolean', errorPos);
      node.selected = value === 'true';
      return;
    }
    this._assert(false, `Unsupported attribute [${key}]`, errorPos);
  }

  private _assert(value: any, message: string, valuePos: number): asserts value {
    if (!value)
      this._throwError(message || 'Assertion error', valuePos);
  }
}

export function parseAriaKey(key: string) {
  return KeyParser.parse(key);
}

export class AriaKeyError extends Error {
  readonly shortMessage: string;
  readonly pos: number;

  constructor(message: string, input: string, pos: number) {
    super(message + ':\n\n' + input + '\n' + ' '.repeat(pos) + '^\n');
    this.shortMessage = message;
    this.pos = pos;
    this.stack = undefined;
  }
}
