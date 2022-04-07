/**
 * Copyright 2017 Google Inc. All rights reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
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
const md = require('../markdown');
const Documentation = require('./documentation');

/** @typedef {import('../markdown').MarkdownNode} MarkdownNode */

class ApiParser {
  /**
   * @param {string} apiDir
   * @param {string=} paramsPath
   */
  constructor(apiDir, paramsPath) {
    let bodyParts = [];
    for (const name of fs.readdirSync(apiDir)) {
      if (!name.endsWith('.md'))
        continue;
      if (name === 'params.md')
        paramsPath = path.join(apiDir, name);
      else
        bodyParts.push(fs.readFileSync(path.join(apiDir, name)).toString());
    }
    const body = md.parse(bodyParts.join('\n'));
    const params = paramsPath ? md.parse(fs.readFileSync(paramsPath).toString()) : null;
    checkNoDuplicateParamEntries(params);
    const api = params ? applyTemplates(body, params) : body;
    /** @type {Map<string, Documentation.Class>} */
    this.classes = new Map();
    md.visitAll(api, node => {
      if (node.type === 'h1')
        this.parseClass(node);
    });
    md.visitAll(api, node => {
      if (node.type === 'h2')
        this.parseMember(node);
    });
    md.visitAll(api, node => {
      if (node.type === 'h3')
        this.parseArgument(node);
    });
    this.documentation = new Documentation([...this.classes.values()]);
    this.documentation.index();
  }

  /**
   * @param {MarkdownNode} node
   */
  parseClass(node) {
    let extendsName = null;
    const name = node.text.substring('class: '.length);
    for (const member of node.children) {
      if (member.type.startsWith('h'))
        continue;
      if (member.type === 'li' && member.liType === 'bullet' && member.text.startsWith('extends: [')) {
        extendsName = member.text.substring('extends: ['.length, member.text.indexOf(']'));
        continue;
      }
    }
    const clazz = new Documentation.Class(extractLangs(node), name, [], extendsName, extractComments(node));
    this.classes.set(clazz.name, clazz);
  }


  /**
   * @param {MarkdownNode} spec
   */
  parseMember(spec) {
    const match = spec.text.match(/(event|method|property|async method): ([^.]+)\.(.*)/);
    if (!match)
      throw new Error('Invalid member: ' + spec.text);
    const name = match[3];
    let returnType = null;
    let optional = false;
    for (const item of spec.children || []) {
      if (item.type === 'li' && item.liType === 'default') {
        const parsed = this.parseType(item);;
        returnType = parsed.type;
        optional = parsed.optional;
      }
    }
    if (!returnType)
      returnType = new Documentation.Type('void');

    const comments = extractComments(spec);
    let member;
    if (match[1] === 'event')
      member = Documentation.Member.createEvent(extractLangs(spec), name, returnType, comments);
    if (match[1] === 'property')
      member = Documentation.Member.createProperty(extractLangs(spec), name, returnType, comments, !optional);
    if (match[1] === 'method' || match[1] === 'async method') {
      member = Documentation.Member.createMethod(extractLangs(spec), name, [], returnType, comments);
      if (match[1] === 'async method')
        member.async = true;
    }
    const clazz = this.classes.get(match[2]);
    const existingMember = clazz.membersArray.find(m => m.name === name && m.kind === member.kind);
    if (existingMember && isTypeOverride(existingMember, member)) {
      for (const lang of member.langs.only) {
        existingMember.langs.types = existingMember.langs.types || {};
        existingMember.langs.types[lang] = returnType;
      }
    } else {
      clazz.membersArray.push(member);
    }
  }

  /**
   * @param {MarkdownNode} spec
   */
  parseArgument(spec) {
    const match = spec.text.match(/(param|option): (.*)/);
    if (!match)
      throw `Something went wrong with matching ${spec.text}`;

    // For "test.describe.only.title":
    // - className is "test"
    // - methodName is "describe.only"
    // - argument name is "title"
    const parts = match[2].split('.');
    const className = parts[0];
    const name = parts[parts.length - 1];
    const methodName = parts.slice(1, parts.length - 1).join('.');

    const clazz = this.classes.get(className);
    if (!clazz)
      throw new Error('Invalid class ' + className);
    const method = clazz.membersArray.find(m => m.kind === 'method' && m.name === methodName);
    if (!method)
      throw new Error(`Invalid method ${className}.${methodName} when parsing: ${match[0]}`);
    if (!name)
      throw new Error('Invalid member name ' + spec.text);
    if (match[1] === 'param') {
      const arg = this.parseProperty(spec);
      arg.name = name;
      const existingArg = method.argsArray.find(m => m.name === arg.name);
      if (existingArg && isTypeOverride(existingArg, arg)) {
        if (!arg.langs || !arg.langs.only)
          throw new Error('Override does not have lang: ' + spec.text);
        for (const lang of arg.langs.only) {
          existingArg.langs.overrides = existingArg.langs.overrides || {};
          existingArg.langs.overrides[lang] = arg;
        }
      } else {
        method.argsArray.push(arg);
      }
    } else {
      let options = method.argsArray.find(o => o.name === 'options');
      if (!options) {
        const type = new Documentation.Type('Object', []);
        options = Documentation.Member.createProperty({}, 'options', type, undefined, false);
        method.argsArray.push(options);
      }
      const p = this.parseProperty(spec);
      p.required = false;
      options.type.properties.push(p);
    }
  }

  /**
   * @param {MarkdownNode} spec
   */
  parseProperty(spec) {
    const param = childrenWithoutProperties(spec)[0];
    const text = param.text;
    let typeStart = text.indexOf('<');
    if (text[typeStart - 1] === '?')
      typeStart--;
    const name = text.substring(0, typeStart).replace(/\`/g, '').trim();
    const comments = extractComments(spec);
    const { type, optional } = this.parseType(param);
    return Documentation.Member.createProperty(extractLangs(spec), name, type, comments, !optional);
  }

  /**
   * @param {MarkdownNode=} spec
   * @return {{ type: Documentation.Type, optional: boolean }}
   */
  parseType(spec) {
    const arg = parseVariable(spec.text);
    const properties = [];
    for (const child of spec.children || []) {
      const { name, text } = parseVariable(child.text);
      const comments = /** @type {MarkdownNode[]} */ ([{ type: 'text', text }]);
      const childType = this.parseType(child);
      properties.push(Documentation.Member.createProperty({}, name, childType.type, comments, !childType.optional));
    }
    const type = Documentation.Type.parse(arg.type, properties);
    return { type, optional: arg.optional };
  }
}

/**
 * @param {string} line
 * @returns {{ name: string, type: string, text: string, optional: boolean }}
 */
function parseVariable(line) {
  let match = line.match(/^`([^`]+)` (.*)/);
  if (!match)
    match = line.match(/^(returns): (.*)/);
  if (!match)
    match = line.match(/^(type): (.*)/);
  if (!match)
    match = line.match(/^(argument): (.*)/);
  if (!match)
    throw new Error('Invalid argument: ' + line);
  const name = match[1];
  let remainder = match[2];
  let optional = false;
  if (remainder.startsWith('?')) {
    optional = true;
    remainder = remainder.substring(1);
  }
  if (!remainder.startsWith('<'))
    throw new Error(`Bad argument: "${name}" in "${line}"`);
  let depth = 0;
  for (let i = 0; i < remainder.length; ++i) {
    const c = remainder.charAt(i);
    if (c === '<')
      ++depth;
    if (c === '>')
      --depth;
    if (depth === 0)
      return { name, type: remainder.substring(1, i), text: remainder.substring(i + 2), optional };
  }
  throw new Error('Should not be reached');
}

/**
 * @param {MarkdownNode[]} body
 * @param {MarkdownNode[]} params
 */
function applyTemplates(body, params) {
  const paramsMap = new Map();
  for (const node of params)
    paramsMap.set('%%-' + node.text + '-%%', node);

  const visit = (node, parent) => {
    if (node.text && node.text.includes('-inline- = %%')) {
      const [name, key] = node.text.split('-inline- = ');
      const list = paramsMap.get(key);
      const newChildren = [];
      if (!list)
        throw new Error('Bad template: ' + key);
      for (const prop of list.children) {
        const template = paramsMap.get(prop.text);
        if (!template)
          throw new Error('Bad template: ' + prop.text);
        const children = childrenWithoutProperties(template);
        const { name: argName } = parseVariable(children[0].text);
        newChildren.push({
          type: node.type,
          text: name + argName,
          children: template.children.map(c => md.clone(c))
        });
      }
      const nodeIndex = parent.children.indexOf(node);
      parent.children = [...parent.children.slice(0, nodeIndex), ...newChildren, ...parent.children.slice(nodeIndex + 1)];
    } else if (node.text && node.text.includes(' = %%')) {
      const [name, key] = node.text.split(' = ');
      node.text = name;
      const template = paramsMap.get(key);
      if (!template)
        throw new Error('Bad template: ' + key);
      node.children.push(...template.children.map(c => md.clone(c)));
    }
    for (const child of node.children || [])
      visit(child, node);
    if (node.children)
      node.children = node.children.filter(child => !child.text || !child.text.includes('-inline- = %%'));
  };

  for (const node of body)
    visit(node, null);

  return body;
}

/**
 * @param {MarkdownNode} item
 * @returns {MarkdownNode[]}
 */
function extractComments(item) {
  return (item.children || []).filter(c => {
    if (c.type.startsWith('h'))
      return false;
    if (c.type === 'li' && c.liType === 'default')
      return false;
    if (c.type === 'li' && c.text.startsWith('langs:'))
      return false;
    return true;
  });
}

/**
 * @param {string} apiDir
 * @param {string=} paramsPath
 */
function parseApi(apiDir, paramsPath) {
  return new ApiParser(apiDir, paramsPath).documentation;
}

/**
 * @param {MarkdownNode} spec
 * @returns {import('./documentation').Langs}
 */
function extractLangs(spec) {
  for (const child of spec.children) {
    if (child.type !== 'li' || child.liType !== 'bullet' || !child.text.startsWith('langs:'))
      continue;

    const only = child.text.substring('langs:'.length).trim();
    /** @type {Object<string, string>} */
    const aliases = {};
    for (const p of child.children || []) {
      const match = p.text.match(/alias-(\w+)[\s]*:(.*)/);
      if (match)
        aliases[match[1].trim()] = match[2].trim();
    }
    return {
      only: only ? only.split(',').map(l => l.trim()) : undefined,
      aliases,
      types: {},
      overrides: {}
    };
  }
  return {};
}

/**
 * @param {MarkdownNode} spec
 * @returns {MarkdownNode[]}
 */
function childrenWithoutProperties(spec) {
  return spec.children.filter(c => c.liType !== 'bullet' || !c.text.startsWith('langs'));
}

/**
 * @param {Documentation.Member} existingMember
 * @param {Documentation.Member} member
 * @returns {boolean}
 */
function isTypeOverride(existingMember, member) {
  if (!existingMember.langs.only)
    return true;
  if (member.langs.only.every(l => existingMember.langs.only.includes(l))) {
    return true;
  } else if (member.langs.only.some(l => existingMember.langs.only.includes(l))) {
    throw new Error(`Ambiguous language override for: ${member.name}`);
  }
  return false;
}

/**
 * @param {MarkdownNode[]=} params
 */
function checkNoDuplicateParamEntries(params) {
  if (!params)
    return;
  const entries = new Set();
  for (const node of params) {
    if (entries.has(node.text))
      throw new Error('Duplicate param entry, for language-specific params use prefix (e.g. js-...): ' + node.text);
    entries.add(node.text);
  }
}

module.exports = { parseApi };
