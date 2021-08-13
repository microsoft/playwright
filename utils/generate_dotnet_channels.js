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
const { nodeModuleNameResolver } = require('typescript');
const yaml = require('yaml');
const { visit } = require('./markdown');

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
  ['loadstate', 'LoadState'],
]);

let enumTypes = null;

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
  switch (type) {
    case 'SerializedValue':
      return 'JsonElement';
    case 'boolean':
      return 'bool';
    case 'number':
      return 'int';
    case 'ResourceTiming':
      return 'RequestTimingResult';
    case 'SerializedError':
      return 'Exception';
    case 'SerializedArgument':
      return 'object'
    case 'NameValue':
      return 'KeyValuePair<string, string>';
    default:
      return type;
  }
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
    if (['string', 'boolean', 'number', 'undefined'].includes(type))
      return { ts: mapType(type), scheme: `t${titleCase(type)}`, optional };

    if (channels.has(type))
      return { ts: `${type}`, scheme: `tChannel('${type}')`, optional };
    if (type === 'Channel')
      return { ts: `Channel`, scheme: `tChannel('*')`, optional };
    return { ts: mapType(type), scheme: `tType('${type}')`, optional };
  }
  if (type.type.startsWith('array')) {
    const optional = type.type.endsWith('?');
    const inner = inlineType(type.items, indent, parentName);
    return { ts: `List<${inner.ts}>`, scheme: `tArray(${inner.scheme})`, optional };
  }
  if (type.type.startsWith('enum')) {
    // check our existing ones, I know it's slow, but it'll do for now
    const literals = type.literals.map(x => !x ? "null" : x).sort();
    const possibility1 = literals.join(',');
    const possibility2 = [...literals, 'null'].sort().join(',');
    for (const [enumName, enumType] of enumTypes) {
      const assumedEnum = enumType.map(x => x.replace(/"/g, '')).sort().join(',');
      if (possibility1 === assumedEnum || possibility2 === assumedEnum)
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
      const typeName = inner.ts;
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
  `/*
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

function writeEvent(eventName, event, parent, sourceName) {
  const argsName = `${parent}${eventName}EventArgs`;
  const eventArgs = [licence];

  var e = {
    name: sourceName,
    cs: `internal event EventHandler? ${eventName};`
  };

  if (!event.parameters)
    return e;

  const args = objectType(event.parameters, ``);

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

  e.cs = `internal event EventHandler<${argsName}>? ${eventName};`;
  return e;
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

  if (parentName === 'newDocument')
    return { ts: 'NavigateDocument', scheme: 'tObject()', optional };

  if (parentName === 'getPropertyList')
    return { ts: `JSElementProperty`, scheme: `tObject()`, optional };

  // TODO: this needs to be fixed
  if (['startJSCoverage', 'stopJSCoverage', 'startCSSCoverage', 'stopCSSCoverage'].includes(parentName))
    return { ts: `JsonElement`, scheme: `tObject()`, optional };

  if ('setInputFiles')
    return { ts: `FilePayload`, scheme: `tObject()`, optional };

  if (type.properties
    && type.properties.value
    && type.properties.label
    && type.properties.index)
    return { ts: `SelectOptionValue`, scheme: `tObject()`, optional };
}

function cleanUpName(name) {
  switch (name) {
    case "event":
    case "params":
      return `@${name}`;
    default:
      return name;
  }
}

function buildParameterMap(parameters) {
  const visitParameters = (params, parents = []) => {
    if (!params) return [];
    const ps = [];
    const populateParameter = (param, paramType) => {
      const isOptional = (typeof paramType == 'string' && paramType.endsWith('?'));
      console.log(paramType);
      if (paramType.type && paramType.type.startsWith('enum')) {
        param.type = inlineType(paramType).ts;
      } else if (typeof paramType === 'string') {
        param.type = mapType(paramType.replace('?', ''));
      } else {
        var px = inlineType(paramType);
        param.type = px.ts;
      }
      param.optional = isOptional;
      param.fullName = [...parents, param].map(x => x.name).join("_");
      param.cs = `${param.type}${isOptional ? '?' : ''} ${param.fullName}`
    };
    for (let [paramName, paramType] of Object.entries(params)) {
      var param = {
        name: cleanUpName(paramName),
        children: [],
        type: null,
        optional: false,
        fullName: null,
        cs: null
      }

      if (paramName.startsWith('$mixin')) {
        var mx = mixins.get(paramType);
        ps.push(...visitParameters(mx.properties));
        continue;
      } else if (typeof paramType == 'object') {
        if (paramType.type.startsWith("array") && paramType.items) {
          populateParameter(param, paramType.items);
          param.type = `IEnumerable<${param.type}>`;
          param.cs = `${param.type}${param.optional ? '?' : ''} ${param.name}`;
        } else if (paramType.literals) {
          var enumx = inlineType(paramType);
          param.cs = `${enumx.ts}${param.optional ? '?' : ''} ${param.name}`;
        }
        else
          param.children.push(...visitParameters(paramType.properties, [...parents, param]));
      } else if (typeof paramType == 'string' && paramType.startsWith('array')) {
        console.log("Array found.");
      } else {
        populateParameter(param, paramType);
      }

      ps.push(param);
    }
    return ps;
  }

  return visitParameters(parameters);
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
    if (name === 'EventTarget')
      continue;

    const channelName = `${name}ChannelImpl`;
    if (item.type === 'interface') {
      writeInitializer(name, item);

      const channel = [
        licence,
        `using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using System.Text.Json;
using Microsoft.Playwright.Core;
using Microsoft.Playwright.Helpers;

#nullable enable
namespace Microsoft.Playwright.Transport.Channels
{
internal class ${channelName} : Channel<${name}>
{
  public ${channelName}(string guid, Connection connection, ${name} owner) : base(guid, connection, owner)
  {
  }
`];

      const eventMap = [];
      for (const [originalEventName, event] of Object.entries(item.events || {})) {
        const eventName = getName(originalEventName);
        var ex = writeEvent(eventName, event || {}, name, originalEventName);
        eventMap.push(ex);
        channel.push(`// invoked via ${ex.name}`);
        channel.push(ex.cs);
        channel.push(``);
      }

      for (const [originalMethodName, originalMethod] of Object.entries(item.commands || {})) {
        const method = originalMethod || {};

        const methodName = titleCase(originalMethodName) + 'Async';
        const returnDefinition = {
          type: null,
          optional: false,
          name: null
        };

        if (method.returns) {
          const [returnsName, returnsType] = Object.entries(method.returns)[0];
          const inlinedType = inlineType(returnsType, '', originalMethodName);
          returnDefinition.type = inlinedType.ts;
          returnDefinition.optional = inlinedType.optional;
          returnDefinition.name = returnsName;
        }

        let methodSignature = `internal virtual async `;
        if (returnDefinition.type)
          methodSignature += `Task<${returnDefinition.type}${returnDefinition.optional ? '?' : ''}> `;
        else
          methodSignature += `Task `;

        methodSignature += methodName;

        const params = buildParameterMap(method.parameters);
        const flattenParams = (params) => {
          const p = [];
          for (const px of params) {
            if (px.children.length) {
              p.push(...flattenParams(px.children,));
              continue;
            }
            p.push(px);
          }
          return p;
        };
        const flatParams = flattenParams(params);
        methodSignature += `(${flatParams.map(x => x.cs).join(',\n\t\t')})`;

        const pushIndented = function (val, indent = `\t\t`) {
          channel.push(`${indent}${val}`);
        };

        channel.push(methodSignature);
        channel.push(`\t=> ${returnDefinition.type ? '(' : ''}await Connection.SendMessageToServerAsync<JsonElement${returnDefinition.optional ? '?' : ''}>(`);
        pushIndented(`Guid,`);
        pushIndented(`"${originalMethodName}",`);
        if (method.parameters) {
          const visitParameter = (parameters, indent = '', prefix = '') => {
            pushIndented(`${prefix}new`, indent);
            pushIndented(`{`, indent);

            for (const param of parameters) {
              if (param.children.length)
                visitParameter(param.children, indent + '\t', `${param.name} = `);
              else {
                if(param.type === 'Exception') 
                  param.fullName += '.ToObject()'
                
                  pushIndented(`${param.name} = ${param.fullName},`, indent)
              }
            }
            pushIndented(`}${prefix ? ',' : ''}`, indent);
          };
          visitParameter(params, '\t\t\t');
          pushIndented(')');
        } else {
          pushIndented('null)');
        }

        if (returnDefinition.type === 'string') {
          pushIndented(`.ConfigureAwait(false)).GetString("${returnDefinition.name}", ${returnDefinition.optional});`);
        } else if (!returnDefinition.type) {
          pushIndented(`.ConfigureAwait(false);`);
        } else if (returnDefinition.type.startsWith('JsonElement')) {
          pushIndented(`.ConfigureAwait(false)).GetProperty("${returnDefinition.name}");`);
        } else {
            pushIndented(`.ConfigureAwait(false))${returnDefinition.optional ? '?' : ''}.GetObject<${returnDefinition.type}>("${returnDefinition.name}", Connection);`);
        }
      }
      channel.push(`}`); // end of class
      channel.push(`}`); // end of namespace
      channel.push(`#nullable disable`);
      writeFile(`${channelName}.cs`, channel.join(`\n`), channelsDir);
    }
  }
}

module.exports = { generateChannels };