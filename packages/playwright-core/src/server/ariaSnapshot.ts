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

import type { AriaTemplateNode, AriaTemplateRoleNode } from './injected/ariaSnapshot';
import { yaml } from '../utilsBundle';
import { assert } from '../utils';

export function parseAriaSnapshot(text: string): AriaTemplateNode {
  const fragment = yaml.parse(text);
  if (!Array.isArray(fragment))
    throw new Error('Expected object key starting with "- ":\n\n' + text + '\n');
  const result: AriaTemplateNode = { kind: 'role', role: 'fragment' };
  populateNode(result, fragment);
  return result;
}

function populateNode(node: AriaTemplateRoleNode, container: any[]) {
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

function applyAttribute(node: AriaTemplateRoleNode, key: string, value: string) {
  if (key === 'checked') {
    assert(value === 'true' || value === 'false' || value === 'mixed', 'Value of "checked\" attribute must be a boolean or "mixed"');
    node.checked = value === 'true' ? true : value === 'false' ? false : 'mixed';
    return;
  }
  if (key === 'disabled') {
    assert(value === 'true' || value === 'false', 'Value of "disabled" attribute must be a boolean');
    node.disabled = value === 'true';
    return;
  }
  if (key === 'expanded') {
    assert(value === 'true' || value === 'false', 'Value of "expanded" attribute must be a boolean');
    node.expanded = value === 'true';
    return;
  }
  if (key === 'level') {
    assert(!isNaN(Number(value)), 'Value of "level" attribute must be a number');
    node.level = Number(value);
    return;
  }
  if (key === 'pressed') {
    assert(value === 'true' || value === 'false' || value === 'mixed', 'Value of "pressed" attribute must be a boolean or "mixed"');
    node.pressed = value === 'true' ? true : value === 'false' ? false : 'mixed';
    return;
  }
  if (key === 'selected') {
    assert(value === 'true' || value === 'false', 'Value of "selected" attribute must be a boolean');
    node.selected = value === 'true';
    return;
  }
  throw new Error(`Unsupported attribute [${key}]`);
}

function normalizeWhitespace(text: string) {
  return text.replace(/[\r\n\s\t]+/g, ' ').trim();
}

function valueOrRegex(value: string): string | RegExp {
  return value.startsWith('/') && value.endsWith('/') ? new RegExp(value.slice(1, -1)) : normalizeWhitespace(value);
}

export class KeyParser {
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

  private _skipWhitespace() {
    while (!this._eof() && /\s/.test(this._peek()))
      this._pos++;
  }

  private _readIdentifier(): string {
    if (this._eof())
      this._throwError('Unexpected end of input when expecting identifier');
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
        result += ch;
      } else if (ch === '"') {
        return result;
      } else {
        result += ch;
      }
    }
    this._throwError('Unterminated string');
  }

  private _throwError(message: string): never {
    throw new Error(message + ':\n\n' + this._input + '\n' + ' '.repeat(this._pos) + '^\n');
  }

  private _readRegex(): string {
    let result = '';
    let escaped = false;
    while (!this._eof()) {
      const ch = this._next();
      if (escaped) {
        result += ch;
        escaped = false;
      } else if (ch === '\\') {
        escaped = true;
        result += ch;
      } else if (ch === '/') {
        return result;
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

  private _readFlags(): Map<string, string> {
    const flags = new Map<string, string>();
    while (true) {
      this._skipWhitespace();
      if (this._peek() === '[') {
        this._next();
        this._skipWhitespace();
        const flagName = this._readIdentifier();
        this._skipWhitespace();
        let flagValue = '';
        if (this._peek() === '=') {
          this._next();
          this._skipWhitespace();
          while (this._peek() !== ']' && !this._eof())
            flagValue += this._next();
        }
        this._skipWhitespace();
        if (this._peek() !== ']')
          this._throwError('Expected ]');

        this._next(); // Consume ']'
        flags.set(flagName, flagValue || 'true');
      } else {
        break;
      }
    }
    return flags;
  }

  _parse(): AriaTemplateNode {
    this._skipWhitespace();

    const role = this._readIdentifier() as AriaTemplateRoleNode['role'];
    this._skipWhitespace();
    const name = this._readStringOrRegex() || '';
    const result: AriaTemplateRoleNode = { kind: 'role', role, name };
    const flags = this._readFlags();
    for (const [name, value] of flags)
      applyAttribute(result, name, value);
    this._skipWhitespace();
    if (!this._eof())
      this._throwError('Unexpected input');
    return result;
  }
}
