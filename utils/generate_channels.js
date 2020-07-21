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

const fs = require('fs');
const path = require('path');

const channels = new Set();

function tokenize(source) {
  const lines = source.split('\n').filter(line => {
    const trimmed = line.trim();
    return !!trimmed && trimmed[0] != '#';
  });

  const stack = [{ indent: -1, list: [], words: '' }];
  for (const line of lines) {
    const indent = line.length - line.trimLeft().length;
    const o = { indent, list: [], words: line.split(' ').filter(word => !!word) };

    let current = stack[stack.length - 1];
    while (indent <= current.indent) {
      stack.pop();
      current = stack[stack.length - 1];
    }

    current.list.push(o);
    stack.push(o);
  }
  return stack[0].list;
}

function raise(item) {
  throw new Error(item.words.join(' '));
}

function titleCase(name) {
  return name[0].toUpperCase() + name.substring(1);
}

function inlineType(item, indent) {
  let type = item.words[1];
  const array = type.endsWith('[]');
  if (array)
    type = type.substring(0, type.length - 2);
  let inner = '';
  if (type === 'enum') {
    const literals = item.list.map(literal => {
      if (literal.words.length > 1 || literal.list.length)
        raise(literal);
      return literal.words[0];
    });
    inner = literals.map(literal => `'${literal}'`).join(' | ');
    if (array)
      inner = `(${inner})`;
  } else if (['string', 'boolean', 'number', 'undefined'].includes(type)) {
    inner = type;
  } else if (type === 'object') {
    inner = `{\n${properties(item, indent + '  ')}\n${indent}}`;
  } else if (type === 'binary') {
    inner = 'Binary';
  } else if (channels.has(type)) {
    inner = type + 'Channel';
  } else {
    inner = type;
  }
  return inner + (array ? '[]' : '');
}

function inlineTypeScheme(item, indent) {
  let type = item.words[1];
  const array = type.endsWith('[]');
  if (array)
    type = type.substring(0, type.length - 2);
  let inner = '';
  if (type === 'enum') {
    const literals = item.list.map(literal => {
      if (literal.words.length > 1 || literal.list.length)
        raise(literal);
      return literal.words[0];
    });
    inner = `tEnum([${literals.map(literal => `'${literal}'`).join(', ')}])`;
  } else if (['string', 'boolean', 'number', 'undefined'].includes(type)) {
    inner = `t${titleCase(type)}`;
  } else if (type === 'object') {
    inner = `tObject({\n${propertiesScheme(item, indent + '  ')}\n${indent}})`;
  } else if (type === 'binary') {
    inner = 'tBinary';
  } else if (channels.has(type)) {
    inner = `tChannel('${type}')`;
  } else if (type === 'Channel') {
    inner = `tChannel('*')`;
  } else {
    inner = `tType('${type}')`;
  }
  return array ? `tArray(${inner})` : inner;
}

function properties(item, indent) {
  const result = [];
  for (const prop of item.list) {
    if (prop.words.length !== 2)
      raise(prop);
    let name = prop.words[0];
    if (!name.endsWith(':'))
      raise(item);
    name = name.substring(0, name.length - 1);
    const optional = name.endsWith('?');
    if (optional)
      name = name.substring(0, name.length - 1);
    result.push(`${indent}${name}${optional ? '?' : ''}: ${inlineType(prop, indent)},`);
  }
  return result.join('\n');
}

function propertiesScheme(item, indent) {
  const result = [];
  for (const prop of item.list) {
    if (prop.words.length !== 2)
      raise(prop);
    let name = prop.words[0];
    if (!name.endsWith(':'))
      raise(item);
    name = name.substring(0, name.length - 1);
    const optional = name.endsWith('?');
    if (optional)
      name = name.substring(0, name.length - 1);
    let type = inlineTypeScheme(prop, indent);
    if (optional)
      type = `tOptional(${type})`;
    result.push(`${indent}${name}: ${type},`);
  }
  return result.join('\n');
}

function objectType(name, item, indent) {
  if (!item.list.length)
    return `export type ${name} = {};`;
  return `export type ${name} = {\n${properties(item, indent)}\n};`
}

function objectTypeScheme(item, indent) {
  if (!item.list.length)
    return `tObject({})`;
  return `tObject({\n${propertiesScheme(item, indent)}\n})`
}

const channels_ts = [
`/**
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

// This file is generated by ${path.basename(__filename)}, do not edit manually.

import { EventEmitter } from 'events';

export type Binary = string;

export interface Channel extends EventEmitter {
}
`];

const pdl = fs.readFileSync(path.join(__dirname, '..', 'src', 'rpc', 'protocol.pdl'), 'utf-8');
const list = tokenize(pdl);
const scheme = new Map();
const inherits = new Map();

function addScheme(name, s) {
  if (scheme.has(name))
    throw new Error('Duplicate scheme name ' + name);
  scheme.set(name, s);
}

for (const item of list) {
  if (item.words[0] === 'interface') {
    channels.add(item.words[1]);
    if (item.words[2] === 'extends')
      inherits.set(item.words[1], item.words[3]);
  }
}

for (const item of list) {
  if (item.words[0] === 'type') {
    if (item.words.length !== 2)
      raise(item);
    channels_ts.push(`export type ${item.words[1]} = {`);
    channels_ts.push(properties(item, '  '));
    channels_ts.push(`};`);
    addScheme(item.words[1], objectTypeScheme(item, '  '));
  } else if (item.words[0] === 'interface') {
    const channelName = item.words[1];
    channels_ts.push(`// ----------- ${channelName} -----------`);
    const init = item.list.find(i => i.words[0] === 'initializer');
    if (init && init.words.length > 1)
      raise(init);
    channels_ts.push(objectType(channelName + 'Initializer', init || { list: [] }, '  '));
    addScheme(channelName + 'Initializer', objectTypeScheme(init || { list: [] }, '  '));

    let extendsName = 'Channel';
    if (item.words.length === 4 && item.words[2] === 'extends')
      extendsName = item.words[3] + 'Channel';
    else if (item.words.length !== 2)
      raise(item);
    channels_ts.push(`export interface ${channelName}Channel extends ${extendsName} {`);

    const types = new Map();
    for (const method of item.list) {
      if (method === init)
        continue;
      if (method.words[0] === 'command') {
        if (method.words.length !== 2)
          raise(method);
        const methodName = method.words[1];

        const parameters = method.list.find(i => i.words[0] === 'parameters');
        const paramsName = `${channelName}${titleCase(methodName)}Params`;
        types.set(paramsName, parameters || { list: [] });
        addScheme(paramsName, parameters ? objectTypeScheme(parameters, '  ') : `tOptional(tObject({}))`);

        const returns = method.list.find(i => i.words[0] === 'returns');
        const resultName = `${channelName}${titleCase(methodName)}Result`;
        types.set(resultName, returns);
        addScheme(resultName, returns ? objectTypeScheme(returns, '  ') : `tUndefined`);

        channels_ts.push(`  ${methodName}(params${parameters ? '' : '?'}: ${paramsName}): Promise<${resultName}>;`);
        for (const key of inherits.keys()) {
          if (inherits.get(key) === channelName) {
            addScheme(`${key}${titleCase(methodName)}Params`, `tType('${paramsName}')`);
            addScheme(`${key}${titleCase(methodName)}Result`, `tType('${resultName}')`);
          }
        }
      } else if (method.words[0] === 'event') {
        if (method.words.length !== 2)
          raise(method);
        const eventName = method.words[1];

        const parameters = method.list.find(i => i.words[0] === 'parameters');
        const paramsName = `${channelName}${titleCase(eventName)}Event`;
        types.set(paramsName, parameters || { list: [] });
        addScheme(paramsName, objectTypeScheme(parameters || { list: [] }, '  '));

        channels_ts.push(`  on(event: '${eventName}', callback: (params: ${paramsName}) => void): this;`);
        for (const key of inherits.keys()) {
          if (inherits.get(key) === channelName)
            addScheme(`${key}${titleCase(eventName)}Event`, `tType('${paramsName}')`);
        }
      } else {
        raise(method);
      }
    }
    channels_ts.push(`}`);
    for (const [name, item] of types) {
      if (!item)
        channels_ts.push(`export type ${name} = void;`);
      else
        channels_ts.push(objectType(name, item, '  '));
    }
  } else {
    raise(item);
  }
  channels_ts.push(``);
}


const client_validator_ts = [
`/**
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

// This file is generated by ${path.basename(__filename)}, do not edit manually.

import { scheme, tOptional, tObject, tBoolean, tNumber, tString, tType, tEnum, tArray, tChannel, tUndefined, tBinary } from './validatorPrimitives';
export { validateParams } from './validatorPrimitives';
`];
for (const [name, value] of scheme)
  client_validator_ts.push(`scheme.${name} = ${value};`);
client_validator_ts.push(``);

fs.writeFileSync(path.join(__dirname, '..', 'src', 'rpc', 'channels.ts'), channels_ts.join('\n'), 'utf-8');
fs.writeFileSync(path.join(__dirname, '..', 'src', 'rpc', 'client', 'validator.ts'), client_validator_ts.join('\n'), 'utf-8');
