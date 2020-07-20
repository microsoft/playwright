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

function inlineType(type, item, indent) {
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
    inner = literals.map(literal => `"${literal}"`).join(' | ');
    if (array)
      inner = `(${inner})`;
  } else if (['string', 'boolean', 'number', 'undefined'].includes(type)) {
    inner = type;
  } else if (type === 'object') {
    inner = `{\n${properties(item, indent + '  ')}\n${indent}}`;
  } else if (type === 'binary') {
    inner = 'Binary';
  } else if (type === 'Error') {
    inner = 'SerializedError';
  } else if (channels.has(type)) {
    inner = type + 'Channel';
  } else {
    inner = type;
  }
  return inner + (array ? '[]' : '');
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
    result.push(`${indent}${name}${optional ? '?' : ''}: ${inlineType(prop.words[1], prop, indent)},`);
  }
  return result.join('\n');
}

function objectType(name, item, indent) {
  if (!item.list.length)
    return `export type ${name} = {};`;
  return `export type ${name} = {\n${properties(item, indent)}\n};`
}

const result = [
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

import { EventEmitter } from 'events';

export type Binary = string;

export type SerializedError = {
  message: string,
  name: string,
  stack?: string,
};

export interface Channel extends EventEmitter {
}
`];

const pdl = fs.readFileSync(path.join(__dirname, '..', 'src', 'rpc', 'protocol.pdl'), 'utf-8');
const list = tokenize(pdl);

for (const item of list) {
  if (item.words[0] === 'interface')
    channels.add(item.words[1]);
}

for (const item of list) {
  if (item.words[0] === 'union') {
    if (item.words.length !== 2)
      raise(item);
    result.push(`export type ${item.words[1]} = ${item.list.map(clause => {
      if (clause.words.length !== 1)
        raise(clause);
      return inlineType(clause.words[0], clause, '  ');
    }).join(' | ')};`);
  } else if (item.words[0] === 'type') {
    if (item.words.length !== 2)
      raise(item);
    result.push(`export type ${item.words[1]} = {`);
    result.push(properties(item, '  '));
    result.push(`};`);
  } else if (item.words[0] === 'interface') {
    const channelName = item.words[1];
    result.push(`// ----------- ${channelName} ----------- `);
    const init = item.list.find(i => i.words[0] === 'initializer');
    if (init && init.words.length > 1)
      raise(init);
    result.push(objectType(channelName + 'Initializer', init || { list: [] }, '  '));
    result.push(`export interface ${channelName}Channel extends Channel {`);
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

        const returns = method.list.find(i => i.words[0] === 'returns');
        const resultName = `${channelName}${titleCase(methodName)}Result`;
        types.set(resultName, returns);

        result.push(`  ${methodName}(params: ${paramsName}): Promise<${resultName}>;`);
      } else if (method.words[0] === 'event') {
        if (method.words.length !== 2)
          raise(method);
        const eventName = method.words[1];

        const parameters = method.list.find(i => i.words[0] === 'parameters');
        const paramsName = `${channelName}${titleCase(eventName)}Event`;
        types.set(paramsName, parameters || { list: [] });

        result.push(`  on(event: '${eventName}', callback: (params: ${paramsName}) => void): this;`);
      } else {
        raise(method);
      }
    }
    result.push(`}`);
    for (const [name, item] of types) {
      if (!item)
        result.push(`export type ${name} = void;`);
      else
        result.push(objectType(name, item, '  '));
    }
  } else {
    raise(item);
  }
  result.push(``);
}

fs.writeFileSync(path.join(__dirname, '..', 'src', 'rpc', 'channel.ts'), result.join('\n'), 'utf-8');
