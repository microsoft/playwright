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
const { execSync } = require('child_process');

const channels = new Set();
const inherits = new Map();
const mixins = new Map();

const protocolDir = path.join(process.argv[2], 'Transport', 'Protocol', 'Generated');
const channelsDir = path.join(process.argv[2], 'Transport', 'Channels', 'Generated');
const eventArgsDir = path.join(process.argv[2], 'Transport', 'Channels', 'EventArgs', 'Generated');
fs.mkdirSync(protocolDir, { recursive: true });
fs.mkdirSync(channelsDir, { recursive: true });
fs.mkdirSync(eventArgsDir, { recursive: true });

const namePrettyMap = new Map([
  ["loadstate", "LoadState"]
]);

var enumTypes = null;

function raise(item) {
  throw new Error('Invalid item: ' + JSON.stringify(item, null, 2));
}

function getName(name) {
  name = namePrettyMap.get(name) || name;
  return titleCase(name);
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

function inlineType(type, indent = '', parentName) {
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
      return { ts: `${type}`, scheme: `tChannel('${type}')`, optional };
    if (type === 'Channel')
      return { ts: `Channel`, scheme: `tChannel('*')`, optional };
    return { ts: mapType(type), scheme: `tType('${type}')`, optional };
  }
  if (type.type.startsWith('array')) {
    const optional = type.type.endsWith('?');
    const inner = inlineType(type.items, indent);
    return { ts: `List<${inner.ts}>`, scheme: `tArray(${inner.scheme})`, optional };
  }
  if (type.type.startsWith('enum')) {
    // check our existing ones, I know it's slow, but it'll do for now
    for (let [ enumName, enumType ] of enumTypes) {
      if (enumType.map(x => x.replace(/"/g, '')).sort().join(',') === type.literals.sort().join(','))
        return { ts: enumName, scheme: `tEnum`, optional: false };
    }
    return { ts: 'string', scheme: `tString`, optional: false };
  }
  if (type.type.startsWith('object')) {
    const optional = type.type.endsWith('?');
    const custom = processCustomType(type, optional, parentName);
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
      const inner = inlineType(value, indent, name);
      if (onlyOptional && !inner.optional)
        continue;
      var typeName = inner.ts;
      ts.push('');
      ts.push(`${indent}public ${typeName}${nullableSuffix(inner)} ${getName(name)} { get; set; }`);
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

const licence =
  `
/*
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
*
*
* ------------------------------------------------------------------------------
* <auto-generated>
* This file is generated by ${path.basename(__filename).split(path.sep).join(path.posix.sep)}, do not edit manually.
* </auto-generated>
*/
`;

function writeEvent(eventName, event, parent) {
  var argsName = `${parent}${eventName}EventArgs`;
  const eventArgs = [licence];

  if (!event.parameters)
    return `internal event EventHandler ${eventName};`;

  var args = objectType(event.parameters, ``);

  eventArgs.push('using System;');
  eventArgs.push('using Microsoft.Playwright.Core;');
  eventArgs.push(``);
  eventArgs.push(`namespace Microsoft.Playwright.Transport.Channels`);
  eventArgs.push(`{`);
  eventArgs.push(`    internal class ${argsName} : EventArgs`);
  eventArgs.push(args.ts);
  eventArgs.push(`}`);
  eventArgs.push(``);

  writeFile(`${argsName}.cs`, eventArgs.join(`\n`), eventArgsDir);

  return `internal event EventHandler<${argsName}> ${eventName};`;
}

function writeInitializer(name, item) {
  const init = objectType(item.initializer || {}, '    ');
  const initializer = [licence];
  const initializerName = name + 'Initializer';
  const superName = inherits.get(name);
  initializer.push('using System.Collections.Generic;');
  initializer.push('using Microsoft.Playwright.Core;');
  initializer.push(``);
  initializer.push(`namespace Microsoft.Playwright.Transport.Protocol`);
  initializer.push(`{`);
  initializer.push(`    internal class ${initializerName}${superName ? ' : ' + superName + 'Initializer' : ''}`);
  initializer.push(init.ts);
  initializer.push(`}`);
  initializer.push(``);
  writeFile(`${initializerName}.cs`, initializer.join('\n'), protocolDir);
}

function writeFile(file, content, folder) {
  fs.writeFileSync(path.join(folder, file), content, 'utf8');
}

function processCustomType(type, optional, parentName) {
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
  if (parentName === 'newDocument')
    return { ts: 'NavigateDocument', scheme: 'tObject()', optional };
}

function generateChannels(mappedEnumTypes) {
  enumTypes = mappedEnumTypes;

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

  for (const [name, item] of Object.entries(protocol)) {
    var channelName = `${name}Channel`;
    if (item.type === 'interface') {
      writeInitializer(name, item);

      var channel = [
        licence,
        `using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using Microsoft.Playwright.Core;

namespace Microsoft.Playwright.Transport.Channels
{
internal class ${channelName} : Channel<${name}>
{
  public ${channelName}(string guid, Connection connection, ${name} owner) : base(guid, connection, owner)
  {
  }
`];

      for (let [eventName, event] of Object.entries(item.events || {})) {
        eventName = getName(eventName);
        if (event === null)
          event = {};

        channel.push(writeEvent(eventName, event, channelName));
        channel.push(``);
        // const parameters = objectType(event.parameters || {}, '');
        // const paramsName = `${channelName}${titleCase(eventName)}Event`;
        // ts_types.set(paramsName, parameters.ts);
        // channels_ts.push(`  on(event: '${eventName}', callback: (params: ${paramsName}) => void): this;`);
      }

      for (let [methodName, method] of Object.entries(item.commands || {})) {
        if (method === null)
          method = {};
        channel.push(`// method: ${methodName}`);
        // if (method.tracing && method.tracing.snapshot) {
        //   tracingSnapshots.push(name + '.' + methodName);
        //   for (const derived of derivedClasses.get(name) || [])
        //     tracingSnapshots.push(derived + '.' + methodName);
        // }
        // const parameters = objectType(method.parameters || {}, '');
        // const paramsName = `${channelName}${titleCase(methodName)}Params`;
        // const optionsName = `${channelName}${titleCase(methodName)}Options`;
        // ts_types.set(paramsName, parameters.ts);
        // ts_types.set(optionsName, objectType(method.parameters || {}, '', true).ts);
        // addScheme(paramsName, method.parameters ? parameters.scheme : `tOptional(tObject({}))`);
        // for (const key of inherits.keys()) {
        //   if (inherits.get(key) === channelName)
        //     addScheme(`${key}${titleCase(methodName)}Params`, `tType('${paramsName}')`);
        // }

        // const resultName = `${channelName}${titleCase(methodName)}Result`;
        // const returns = objectType(method.returns || {}, '');
        // ts_types.set(resultName, method.returns ? returns.ts : 'void');

        // channels_ts.push(`  ${methodName}(params${method.parameters ? '' : '?'}: ${paramsName}, metadata?: Metadata): Promise<${resultName}>;`);
      }
      channel.push(`}`); // end of class
      channel.push(`}`); // end of namespace
      writeFile(`${channelName}.cs`, channel.join(`\n`), channelsDir);
    }
  }
}

// if (process.argv[3] !== "--skip-format") {
//   // run the formatting tool for .net, to ensure the files are prepped
//   execSync(`dotnet format -f "${process.argv[2]}" --include-generated --fix-whitespace`);
// }

module.exports = { generateChannels }