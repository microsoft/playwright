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
const os = require('os');
const path = require('path');
const yaml = require('yaml');

const channels = new Set();
const inherits = new Map();
const mixins = new Map();

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
  if (type === 'ResourceTiming')
    return 'RequestTimingResult';
  return type;
}

function nullableSuffix(inner) {
  if (['int', 'boolean'].includes(inner.ts))
    return inner.optional ? '?' : '';
  return '';
}

function inlineType(type, indent = '', wrapEnums = false) {
  if (typeof type === 'string') {
    const optional = type.endsWith('?');
    if (optional)
      type = type.substring(0, type.length - 1);
    if (type === 'binary')
      return { ts: 'string', scheme: 'tString', optional };
    if (type === 'json')
      return { ts: 'any', scheme: 'tAny', optional };
    if (['string', 'boolean', 'number', 'undefined'].includes(type)) {
      return { ts: mapType(type), scheme: `t${titleCase(type)}`, optional };
    }
    if (channels.has(type))
      return { ts: `${type}`, scheme: `tChannel('${type}')` , optional };
    if (type === 'Channel')
      return { ts: `Channel`, scheme: `tChannel('*')`, optional };
    return { ts: mapType(type), scheme: `tType('${type}')`, optional };
  }
  if (type.type.startsWith('array')) {
    const optional = type.type.endsWith('?');
    const inner = inlineType(type.items, indent, true);
    return { ts: `List<${inner.ts}>`, scheme: `tArray(${inner.scheme})`, optional };
  }
  if (type.type.startsWith('enum')) {
    if (type.literals.includes('networkidle'))
      return { ts: 'LoadState', scheme: `tString`, optional: false };
    return { ts: 'string', scheme: `tString`, optional: false };
  }
  if (type.type.startsWith('object')) {
    const optional = type.type.endsWith('?');
    const custom = processCustomType(type, optional);
    if (custom)
      return custom;
    const inner = properties(type.properties, indent + '  ');
    return {
      ts: `{\n${inner.ts}\n${indent}}`,
      scheme: `tObject({\n${inner.scheme}\n${indent}})`,
      optional
    };
  }
  raise(type);
}

function properties(properties, indent, onlyOptional) {
  const ts = [];
  const scheme = [];
  const visitProperties = props => {
    for (const [name, value] of Object.entries(props)) {
      if (name === 'android' || name === 'electron')
        continue;
      if (name.startsWith('$mixin')) {
        visitProperties(mixins.get(value).properties);
        continue;
      }
      const inner = inlineType(value, indent);
      if (onlyOptional && !inner.optional)
        continue;
      ts.push('');
      ts.push(`${indent}public ${inner.ts}${nullableSuffix(inner)} ${toTitleCase(name)} { get; set; }`);
      const wrapped = inner.optional ? `tOptional(${inner.scheme})` : inner.scheme;
      scheme.push(`${indent}${name}: ${wrapped},`);
    }
  };
  visitProperties(properties);
  return { ts: ts.join('\n'), scheme: scheme.join('\n') };
}

function objectType(props, indent, onlyOptional = false) {
  if (!Object.entries(props).length)
    return { ts: `${indent}{\n${indent}}`, scheme: `tObject({})` };
  const inner = properties(props, indent + '    ', onlyOptional);
  return { ts: `${indent}{${inner.ts}\n${indent}}`, scheme: `tObject({\n${inner.scheme}\n${indent}})` };
}

const yml = fs.readFileSync(path.join(__dirname, '..', 'src', 'protocol', 'protocol.yml'), 'utf-8');
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

const dir = path.join(process.argv[2], 'Transport', 'Protocol', 'Generated')
fs.mkdirSync(dir, { recursive: true });

for (const [name, item] of Object.entries(protocol)) {
  if (item.type === 'interface') {
    const channelName = name;
    const channels_ts = [];
    const init = objectType(item.initializer || {}, '    ');
    const initializerName = channelName + 'Initializer';
    const superName = inherits.get(name);
    channels_ts.push('using System.Collections.Generic;');
    channels_ts.push('using Microsoft.Playwright.Core;');
    channels_ts.push(``);
    channels_ts.push(`namespace Microsoft.Playwright.Transport.Protocol`);
    channels_ts.push(`{`);
    channels_ts.push(`    internal class ${initializerName}${superName ? ' : ' + superName + 'Initializer' : ''}`);
    channels_ts.push(init.ts);
    channels_ts.push(`}`);
    channels_ts.push(``);
    writeFile(`${initializerName}.cs`, channels_ts.join('\n'));
  }
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

function processCustomType(type, optional) {
  if (type.properties.name
      && type.properties.value
      && inlineType(type.properties.name).ts === 'string'
      && inlineType(type.properties.value).ts === 'string') {
    return { ts: 'HeaderEntry', scheme: 'tObject()', optional };
  }
  if (type.properties.width
      && type.properties.height
      && inlineType(type.properties.width).ts === 'int'
      && inlineType(type.properties.height).ts === 'int') {
    return { ts: 'ViewportSize', scheme: 'tObject()', optional };
  }
  if (type.properties.url
    && type.properties.lineNumber
    && inlineType(type.properties.url).ts === 'string'
    && inlineType(type.properties.lineNumber).ts === 'int') {
    return { ts: 'ConsoleMessageLocation', scheme: 'tObject()', optional };
  }
  if (type.properties.name
    && type.properties.descriptor
    && inlineType(type.properties.name).ts === 'string') {
    return { ts: 'DeviceDescriptorEntry', scheme: 'tObject()', optional };
  }
}