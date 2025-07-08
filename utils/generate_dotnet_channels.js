#!/usr/bin/env node
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

// @ts-check

const fs = require('fs');
const path = require('path');
const yaml = require('yaml');

const channels = new Set();
const inherits = new Map();
const mixins = new Map();

const COPYRIGHT_HEADER = `/*
 * MIT License
 *
 * Copyright (c) Microsoft Corporation.
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and / or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */
`;

function raise(item) {
  throw new Error('Invalid item: ' + JSON.stringify(item, null, 2));
}

function titleCase(name) {
  return name[0].toUpperCase() + name.substring(1);
}

function mapType(type) {
  if (type === 'SerializedValue')
    return 'System.Text.Json.JsonElement';
  if (type === 'boolean')
    return 'bool';
  if (type === 'number')
    return 'int';
  // TODO: keep the same names in .NET as upstream
  if (type === 'ResourceTiming')
    return 'RequestTimingResult';
  if (type === 'LifecycleEvent')
    return 'WaitUntilState';
  return type;
}

function nullableSuffix(inner) {
  if (['int', 'bool'].includes(inner.ts))
    return inner.optional ? '?' : '';
  return '';
}

function inlineType(type, indent = '', name, level) {
  if (typeof type === 'string') {
    const optional = type.endsWith('?');
    if (optional)
      type = type.substring(0, type.length - 1);
    if (type === 'binary')
      return { ts: 'byte[]', scheme: 'tArray(tByte)', optional };
    if (type === 'json')
      return { ts: 'any', scheme: 'tAny', optional };
    if (['string', 'boolean', 'number', 'undefined'].includes(type))
      return { ts: mapType(type), scheme: `t${titleCase(type)}`, optional };
    if (channels.has(type))
      return { ts: `Core.${type}`, scheme: `tChannel('${type}')`, optional };
    if (type === 'Channel')
      return { ts: `Channel`, scheme: `tChannel('*')`, optional };
    return { ts: mapType(type), scheme: `tType('${type}')`, optional };
  }
  if (type.type.startsWith('array')) {
    const optional = type.type.endsWith('?');
    const inner = inlineType(type.items, indent, name, level);
    return { ts: `List<${inner.ts}>`, scheme: `tArray(${inner.scheme})`, optional };
  }
  if (type.type.startsWith('enum')) {
    if (type.literals.includes('networkidle'))
      return { ts: 'LoadState', scheme: `tString`, optional: false };
    return { ts: 'string', scheme: `tString`, optional: false };
  }
  if (type.type.startsWith('object')) {
    const optional = type.type.endsWith('?');

    const custom = processCustomType(type, optional, name);
    if (custom)
      return custom;
    if (level >= 1) {
      const inner = properties(type.properties, '        ', false, name, level);
      writeCSharpClass(name, null, '    {' + inner.ts + '\n    }');
      return { ts: name, scheme: 'tObject()', optional };
    }

    const inner = properties(type.properties, indent + '  ', false, name, level);
    return {
      ts: `{\n${inner.ts}\n${indent}}`,
      scheme: `tObject({\n${inner.scheme}\n${indent}})`,
      optional
    };
  }
  raise(type);
}

function properties(properties, indent, onlyOptional, parentName, level) {
  const ts = [];
  const scheme = [];
  const visitProperties = (props, parentName) => {
    for (const [name, value] of Object.entries(props)) {
      if (name === 'android' || name === 'electron')
        continue;
      if (name.startsWith('$mixin')) {
        visitProperties(mixins.get(value).properties, parentName);
        continue;
      }
      const inner = inlineType(value, indent, parentName + toTitleCase(name), level + 1);
      if (onlyOptional && !inner.optional)
        continue;
      ts.push('');
      ts.push(`${indent}[JsonPropertyName("${name}")]`);
      let suffix = ''
      if (!['bool', 'int', 'System.Text.Json.JsonElement'].includes(inner.ts))
        suffix = ' = null!;'
      ts.push(`${indent}public ${inner.ts}${nullableSuffix(inner)} ${toTitleCase(name)} { get; set; }${suffix}`);
      const wrapped = inner.optional ? `tOptional(${inner.scheme})` : inner.scheme;
      scheme.push(`${indent}${name}: ${wrapped},`);
    }
  };
  visitProperties(properties, parentName);
  return { ts: ts.join('\n'), scheme: scheme.join('\n') };
}

function objectType(props, indent, onlyOptional = false, parentName = '') {
  if (!Object.entries(props).length)
    return { ts: `${indent}{\n${indent}}`, scheme: `tObject({})` };
  const inner = properties(props, indent + '    ', onlyOptional, parentName, 0);
  return { ts: `${indent}{${inner.ts}\n${indent}}`, scheme: `tObject({\n${inner.scheme}\n${indent}})` };
}

const yml = fs.readFileSync(path.join(__dirname, '..', 'packages', 'protocol', 'src', 'protocol.yml'), 'utf-8');
const protocol = yaml.parse(yml);

for (const [name, value] of Object.entries(protocol)) {
  if (value.type === 'interface') {
    channels.add(name);
    if (value.extends)
      inherits.set(name, value.extends);
  }
  if (value.type === 'mixin')
    mixins.set(name, value);
}

if (!process.argv[2]) {
  console.error('.NET repository needs to be specified as an argument.\n' + `Usage: node ${path.relative(process.cwd(), __filename)} ../playwright-dotnet/src/Playwright/`);
  process.exit(1);
}

const dir = path.join(process.argv[2], 'Transport', 'Protocol', 'Generated');
fs.mkdirSync(dir, { recursive: true });

for (const [name, item] of Object.entries(protocol)) {
  if (item.type === 'interface') {
    const initializerName = name + 'Initializer';
    const init = objectType(item.initializer || {}, '', false, initializerName);
    const superName = inherits.has(name) ? inherits.get(name) + 'Initializer' : null;
    writeCSharpClass(initializerName, superName, init.ts);
  } else if (item.type === 'object') {
    if (Object.keys(item.properties).length === 0)
      continue;
    if (['AXNode', 'SetNetworkCookie', 'NetworkCookie', 'IndexedDBDatabase', 'SetOriginStorage', 'OriginStorage'].includes(name))
      continue;
    const init = objectType(item.properties, '', false, name);
    writeCSharpClass(name, null, init.ts);
  }
}

/**
 *
 * @param {string} className
 * @param {string|null} inheritFrom
 * @param {any} serializedProperties
 */
function writeCSharpClass(className, inheritFrom, serializedProperties) {
  if (className === 'SerializedArgument')
    return;
  const channels_ts = [];
  channels_ts.push(COPYRIGHT_HEADER);
  channels_ts.push('using System.Collections.Generic;');
  channels_ts.push('using System.Text.Json.Serialization;');
  channels_ts.push(``);
  channels_ts.push(`namespace Microsoft.Playwright.Transport.Protocol;`);
  channels_ts.push(``);
  channels_ts.push(`internal class ${className}${inheritFrom ? ' : ' + inheritFrom : ''}`);
  channels_ts.push(serializedProperties);
  channels_ts.push(``);
  writeFile(`${className}.cs`, channels_ts.join('\n'));
}

function writeFile(file, content) {
  fs.writeFileSync(path.join(dir, file), content, 'utf8');
}

/**
 * @param {string} name
 * @returns {string}
 */
function toTitleCase(name) {
  return name.charAt(0).toUpperCase() + name.substring(1);
}

function processCustomType(type, optional, fullName) {
  if (type.properties.name
      && type.properties.value
      && inlineType(type.properties.name).ts === 'string'
      && inlineType(type.properties.value).ts === 'string')
    return { ts: 'HeaderEntry', scheme: 'tObject()', optional };

  if (type.properties.width
      && type.properties.height
      && inlineType(type.properties.width).ts === 'int'
      && inlineType(type.properties.height).ts === 'int')
    return { ts: 'ViewportSize', scheme: 'tObject()', optional };

  if (type.properties.url
    && type.properties.lineNumber
    && inlineType(type.properties.url).ts === 'string'
    && inlineType(type.properties.lineNumber).ts === 'int')
    return { ts: 'ConsoleMessageLocation', scheme: 'tObject()', optional };

  if (type.properties.name
    && type.properties.descriptor
    && inlineType(type.properties.name).ts === 'string')
    return { ts: 'DeviceDescriptorEntry', scheme: 'tObject()', optional };

  if (fullName === 'BrowserContextInitializerOptions')
    return { ts: 'System.Text.Json.JsonElement', scheme: 'tObject()', optional };
}
