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

function inlineType(item, indent, optional) {
  let type = item.words[1];
  const array = type.endsWith('[]');
  let prefix = '';
  if (array) {
    type = type.substring(0, type.length - 2);
    indent = '  ' + indent;
    prefix = `\n${indent}type: array${optional ? '?' : ''}\n${indent}items: `;
    optional = false;
  }

  let inner = '';
  if (type === 'enum') {
    const literals = item.list.map(literal => {
      if (literal.words.length > 1 || literal.list.length)
        raise(literal);
      if (literal.words[0] === '-0')
        return '"-0"';
      return literal.words[0];
    });
    inner = `\n${indent}  type: enum${optional ? '?' : ''}\n${indent}  literals:\n` + literals.map(literal => `${indent}  - ${literal}`).join('\n');
  } else if (['string', 'boolean', 'number', 'undefined', 'binary'].includes(type)) {
    inner = type + (optional ? '?' : '');
  } else if (type === 'object') {
    if (item.list.length)
      inner = `\n${indent}  type: object${optional ? '?' : ''}\n${indent}  properties:\n${properties(item, indent + '    ')}`;
    else
      inner = `\n${indent}  type: object${optional ? '?' : ''}`;
  } else if (channels.has(type)) {
    inner = type + (optional ? '?' : '');
  } else {
    inner = type + (optional ? '?' : '');
  }
  return prefix + inner;
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
    result.push(`${indent}${name}: ${inlineType(prop, indent, optional)}`);
  }
  return result.join('\n');
}

const pdl = fs.readFileSync(path.join(__dirname, '..', 'src', 'rpc', 'protocol.pdl'), 'utf-8');
const list = tokenize(pdl);
const channels_ts = [];

function objectType(name, item, indent) {
  if (!item.list.length)
     return;
  channels_ts.push(`${indent}${name}:`);
  channels_ts.push(properties(item, indent + '  '));
}

for (const item of list) {
  if (item.words[0] === 'interface') {
    channels.add(item.words[1]);
  }
}

for (const item of list) {
  if (item.words[0] === 'type') {
    if (item.words.length !== 2)
      raise(item);

    channels_ts.push(`${item.words[1]}:`);
    channels_ts.push(`  type: object`);
    objectType('properties', item, '  ');
    channels_ts.push(``);
  } else if (item.words[0] === 'interface') {
    const channelName = item.words[1];
    channels_ts.push(`${channelName}:`);
    channels_ts.push(`  type: interface`);
    channels_ts.push('');

    let extendsName = 'Channel';
    if (item.words.length === 4 && item.words[2] === 'extends')
      extendsName = item.words[3];
    else if (item.words.length !== 2)
      raise(item);
    if (extendsName !== 'Channel') {
      channels_ts.push(`  extends: ${extendsName}`);
      channels_ts.push('');
    }

    const init = item.list.find(i => i.words[0] === 'initializer');
    if (init && init.words.length > 1)
      raise(init);
    if (init) {
      objectType('initializer', init, '  ');
      channels_ts.push('');
    }

    const commands = item.list.filter(i => i.words[0] === 'command');
    if (commands.length) {
      channels_ts.push(`  commands:`);
      channels_ts.push('');
      for (const method of commands) {
        if (method.words.length !== 2)
          raise(method);
        const methodName = method.words[1];
        channels_ts.push(`    ${methodName}:`);
        // channels_ts.push(`    type: command`);

        const parameters = method.list.find(i => i.words[0] === 'parameters');
        if (parameters)
          objectType(`parameters`, parameters, '      ');

        const returns = method.list.find(i => i.words[0] === 'returns');
        if (returns)
          objectType(`returns`, returns, '      ');
        channels_ts.push('');
      }
    }

    const events = item.list.filter(i => i.words[0] === 'event');
    if (events.length) {
      channels_ts.push(`  events:`);
      channels_ts.push('');
      for (const method of events) {
        if (method.words.length !== 2)
          raise(method);
        const eventName = method.words[1];
        channels_ts.push(`    ${eventName}:`);
        // channels_ts.push(`    type: event`);

        const parameters = method.list.find(i => i.words[0] === 'parameters');
        if (parameters)
          objectType(`parameters`, parameters, '      ');
        channels_ts.push('');
      }
    }

    channels_ts.push(``);
  } else {
    raise(item);
  }
  channels_ts.push(``);
}

const lines = channels_ts.join('\n').split('\n').map(line => line.trimEnd());
fs.writeFileSync(path.join(__dirname, '..', 'src', 'rpc', 'protocol.yml'), lines.join('\n'), 'utf-8');
