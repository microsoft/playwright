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

export type AriaProps = {
  checked?: boolean | 'mixed';
  disabled?: boolean;
  expanded?: boolean;
  active?: boolean;
  level?: number;
  pressed?: boolean | 'mixed';
  selected?: boolean;
};

// We pass parsed template between worlds using JSON, make it easy.
export type AriaRegex = { pattern: string };

export type AriaTemplateTextNode = {
  kind: 'text';
  text: AriaRegex | string;
};

export type AriaTemplateRoleNode = AriaProps & {
  kind: 'role';
  role: AriaRole | 'fragment';
  name?: AriaRegex | string;
  children?: AriaTemplateNode[];
  props?: Record<string, string | AriaRegex>;
  containerMode?: 'contain' | 'equal' | 'deep-equal';
};

export type AriaTemplateNode = AriaTemplateRoleNode | AriaTemplateTextNode;

import type * as yamlTypes from 'yaml';

type YamlLibrary = {
  parseDocument: typeof yamlTypes.parseDocument;
  Scalar: typeof yamlTypes.Scalar;
  YAMLMap: typeof yamlTypes.YAMLMap;
  YAMLSeq: typeof yamlTypes.YAMLSeq;
  LineCounter: typeof yamlTypes.LineCounter;
};

type ParsedYamlPosition = { line: number; col: number; };

export type ParsedYamlError = {
  message: string;
  range: [ParsedYamlPosition, ParsedYamlPosition];
};

export function parseAriaSnapshotUnsafe(yaml: YamlLibrary, text: string): AriaTemplateNode {
  const result = parseAriaSnapshot(yaml, text);
  if (result.errors.length)
    throw new Error(result.errors[0].message);
  return result.fragment;
}

export function parseAriaSnapshot(yaml: YamlLibrary, text: string, options: yamlTypes.ParseOptions = {}): { fragment: AriaTemplateNode, errors: ParsedYamlError[] } {
  const lineCounter = new yaml.LineCounter();
  const parseOptions: yamlTypes.ParseOptions = {
    keepSourceTokens: true,
    lineCounter,
    ...options,
  };
  const yamlDoc = yaml.parseDocument(text, parseOptions);
  const errors: ParsedYamlError[] = [];

  const convertRange = (range: [number, number] | yamlTypes.Range): [ParsedYamlPosition, ParsedYamlPosition] => {
    return [lineCounter.linePos(range[0]), lineCounter.linePos(range[1])];
  };

  const addError = (error: yamlTypes.YAMLError) => {
    errors.push({
      message: error.message,
      range: [lineCounter.linePos(error.pos[0]), lineCounter.linePos(error.pos[1])],
    });
  };

  const convertSeq = (container: AriaTemplateRoleNode, seq: yamlTypes.YAMLSeq) => {
    for (const item of seq.items) {
      const itemIsString = item instanceof yaml.Scalar && typeof item.value === 'string';
      if (itemIsString) {
        const childNode = KeyParser.parse(item, parseOptions, errors);
        if (childNode) {
          container.children = container.children || [];
          container.children.push(childNode);
        }
        continue;
      }
      const itemIsMap = item instanceof yaml.YAMLMap;
      if (itemIsMap) {
        convertMap(container, item);
        continue;
      }
      errors.push({
        message: 'Sequence items should be strings or maps',
        range: convertRange((item as any).range || seq.range),
      });
    }
  };

  const convertMap = (container: AriaTemplateRoleNode, map: yamlTypes.YAMLMap) => {
    for (const entry of map.items) {
      container.children = container.children || [];
      // Key must by a string
      const keyIsString = entry.key instanceof yaml.Scalar && typeof entry.key.value === 'string';
      if (!keyIsString) {
        errors.push({
          message: 'Only string keys are supported',
          range: convertRange((entry.key as any).range || map.range),
        });
        continue;
      }

      const key: yamlTypes.Scalar<string> = entry.key as yamlTypes.Scalar<string>;
      const value = entry.value;

      // - text: "text"
      if (key.value === 'text') {
        const valueIsString = value instanceof yaml.Scalar && typeof value.value === 'string';
        if (!valueIsString) {
          errors.push({
            message: 'Text value should be a string',
            range: convertRange(((entry.value as any).range || map.range)),
          });
          continue;
        }
        container.children.push({
          kind: 'text',
          text: valueOrRegex(value.value)
        });
        continue;
      }

      // - /children: equal
      if (key.value === '/children') {
        const valueIsString = value instanceof yaml.Scalar && typeof value.value === 'string';
        if (!valueIsString || (value.value !== 'contain' && value.value !== 'equal' && value.value !== 'deep-equal')) {
          errors.push({
            message: 'Strict value should be "contain", "equal" or "deep-equal"',
            range: convertRange(((entry.value as any).range || map.range)),
          });
          continue;
        }
        container.containerMode = value.value;
        continue;
      }

      // - /url: "about:blank"
      if (key.value.startsWith('/')) {
        const valueIsString = value instanceof yaml.Scalar && typeof value.value === 'string';
        if (!valueIsString) {
          errors.push({
            message: 'Property value should be a string',
            range: convertRange(((entry.value as any).range || map.range)),
          });
          continue;
        }
        container.props = container.props ?? {};
        container.props[key.value.slice(1)] = valueOrRegex(value.value);
        continue;
      }

      // role "name": ...
      const childNode = KeyParser.parse(key, parseOptions, errors);
      if (!childNode)
        continue;

      // - role "name": "text"
      const valueIsScalar = value instanceof yaml.Scalar;
      if (valueIsScalar) {
        const type = typeof value.value;
        if (type !== 'string' && type !== 'number' && type !== 'boolean') {
          errors.push({
            message: 'Node value should be a string or a sequence',
            range: convertRange(((entry.value as any).range || map.range)),
          });
          continue;
        }

        container.children.push({
          ...childNode,
          children: [{
            kind: 'text',
            text: valueOrRegex(String(value.value))
          }]
        });
        continue;
      }

      // - role "name":
      //   - child
      const valueIsSequence = value instanceof yaml.YAMLSeq;
      if (valueIsSequence) {
        container.children.push(childNode);
        convertSeq(childNode, value as yamlTypes.YAMLSeq);
        continue;
      }

      errors.push({
        message: 'Map values should be strings or sequences',
        range: convertRange((entry.value as any).range || map.range),
      });
    }
  };

  const fragment: AriaTemplateNode = { kind: 'role', role: 'fragment' };

  yamlDoc.errors.forEach(addError);
  if (errors.length)
    return { errors, fragment };

  if (!(yamlDoc.contents instanceof yaml.YAMLSeq)) {
    errors.push({
      message: 'Aria snapshot must be a YAML sequence, elements starting with " -"',
      range: yamlDoc.contents ? convertRange(yamlDoc.contents!.range) : [{ line: 0, col: 0 }, { line: 0, col: 0 }],
    });
  }
  if (errors.length)
    return { errors, fragment };

  convertSeq(fragment, yamlDoc.contents as yamlTypes.YAMLSeq);
  if (errors.length)
    return { errors, fragment: emptyFragment };
  // `- button` should target the button, not its parent.
  if (fragment.children?.length === 1 && (!fragment.containerMode || fragment.containerMode === 'contain'))
    return { fragment: fragment.children[0], errors: [] };
  return { fragment, errors: [] };
}

const emptyFragment: AriaTemplateRoleNode = { kind: 'role', role: 'fragment' };

function normalizeWhitespace(text: string) {
  // TODO: why is this different from normalizeWhitespace in stringUtils.ts?
  return text.replace(/[\u200b\u00ad]/g, '').replace(/[\r\n\s\t]+/g, ' ').trim();
}

export function valueOrRegex(value: string): string | AriaRegex {
  return value.startsWith('/') && value.endsWith('/') && value.length > 1 ? { pattern: value.slice(1, -1) } : normalizeWhitespace(value);
}

export class KeyParser {
  private _input: string;
  private _pos: number;
  private _length: number;

  static parse(text: yamlTypes.Scalar<string>, options: yamlTypes.ParseOptions, errors: ParsedYamlError[]): AriaTemplateRoleNode | null {
    try {
      return new KeyParser(text.value)._parse();
    } catch (e) {
      if (e instanceof ParserError) {
        const message = options.prettyErrors === false ? e.message : e.message + ':\n\n' + text.value + '\n' + ' '.repeat(e.pos) + '^\n';
        errors.push({
          message,
          range: [options.lineCounter!.linePos(text.range![0]), options.lineCounter!.linePos(text.range![0] + e.pos)],
        });
        return null;
      }
      throw e;
    }
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

  private _throwError(message: string, offset: number = 0): never {
    throw new ParserError(message, offset || this._pos);
  }

  private _readRegex(): AriaRegex {
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
        return { pattern: result };
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

  private _readStringOrRegex(): string | AriaRegex | null {
    const ch = this._peek();
    if (ch === '"') {
      this._next();
      return normalizeWhitespace(this._readString());
    }

    if (ch === '/') {
      this._next();
      return this._readRegex();
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

  _parse(): AriaTemplateRoleNode {
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
    if (key === 'active') {
      this._assert(value === 'true' || value === 'false', 'Value of "active" attribute must be a boolean', errorPos);
      node.active = value === 'true';
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

export class ParserError extends Error {
  readonly pos: number;

  constructor(message: string, pos: number) {
    super(message);
    this.pos = pos;
  }
}
