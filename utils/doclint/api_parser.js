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
const docs = require('./documentation');

/** @typedef {import('../markdown').MarkdownNode} MarkdownNode */
/** @typedef {import('../markdown').MarkdownHeaderNode} MarkdownHeaderNode */
/** @typedef {import('../markdown').MarkdownLiNode} MarkdownLiNode */
/** @typedef {import('../markdown').MarkdownTextNode} MarkdownTextNode */

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
    const params = paramsPath ? md.parse(fs.readFileSync(paramsPath).toString()) : undefined;
    checkNoDuplicateParamEntries(params);
    const api = params ? applyTemplates(body, params) : body;
    /** @type {Map<string, docs.Class>} */
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
    this.documentation = new docs.Documentation([...this.classes.values()]);
    this.documentation.index();
  }

  /**
   * @param {MarkdownHeaderNode} node
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
    const metainfo = extractMetainfo(node);
    const clazz = new docs.Class(metainfo, name, [], extendsName, extractComments(node));
    if (metainfo.hidden)
      return;
    this.classes.set(clazz.name, clazz);
  }


  /**
   * @param {MarkdownHeaderNode} spec
   */
  parseMember(spec) {
    const match = spec.text.match(/(event|method|property|async method|optional method|optional async method): ([^.]+)\.(.*)/);
    if (!match)
      throw new Error('Invalid member: ' + spec.text);
    const metainfo = extractMetainfo(spec);
    const name = match[3];
    let returnType = null;
    let optional = false;
    for (const item of spec.children || []) {
      if (item.type === 'li' && item.liType === 'default') {
        const parsed = this.parseType(item, metainfo.since ?? 'v1.0');
        returnType = parsed.type;
        optional = parsed.optional;
      }
    }
    if (!returnType)
      returnType = new docs.Type('void');

    const comments = extractComments(spec);
    let member;
    if (match[1] === 'event')
      member = docs.Member.createEvent(metainfo, name, returnType, comments);
    if (match[1] === 'property')
      member = docs.Member.createProperty(metainfo, name, returnType, comments, !optional);
    if (['method', 'async method', 'optional method', 'optional async method'].includes(match[1])) {
      member = docs.Member.createMethod(metainfo, name, [], returnType, comments);
      if (match[1].includes('async'))
        member.async = true;
      if (match[1].includes('optional'))
        member.required = false;
    }
    if (!member)
      throw new Error('Unknown member: ' + spec.text);

    const clazz = /** @type {docs.Class} */(this.classes.get(match[2]));
    if (!clazz)
      throw new Error(`Unknown class ${match[2]} for member: ` + spec.text);
    if (metainfo.hidden)
      return;

    const existingMember = clazz.membersArray.find(m => m.name === name && m.kind === member.kind);
    if (existingMember && isTypeOverride(existingMember, member)) {
      for (const lang of member?.langs?.only || []) {
        existingMember.langs.types = existingMember.langs.types || {};
        existingMember.langs.types[lang] = returnType;
      }
    } else {
      clazz.membersArray.push(member);
    }
  }

  /**
   * @param {MarkdownHeaderNode} spec
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
      if (!arg)
        return;
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
      // match[1] === 'option'
      const p = this.parseProperty(spec);
      if (!p)
        return;
      let options = method.argsArray.find(o => o.name === 'options');
      if (!options) {
        const type = new docs.Type('Object', []);
        options = docs.Member.createProperty({ langs: {}, since: method.since, deprecated: undefined, discouraged: undefined }, 'options', type, undefined, false);
        method.argsArray.push(options);
      }
      p.required = false;
      options.type?.properties?.push(p);
    }
  }

  /**
   * @param {MarkdownHeaderNode} spec
   * @returns {docs.Member | null}
   */
  parseProperty(spec) {
    const param = childrenWithoutProperties(spec)[0];
    const text = /** @type {string}*/(param.text);
    let typeStart = text.indexOf('<');
    while ('?e'.includes(text[typeStart - 1]))
      typeStart--;
    const name = text.substring(0, typeStart).replace(/\`/g, '').trim();
    const comments = extractComments(spec);
    const metainfo = extractMetainfo(spec);
    if (metainfo.hidden)
      return null;
    const { type, optional } = this.parseType(/** @type {MarkdownLiNode} */(param), metainfo.since ?? 'v1.0');
    return docs.Member.createProperty(metainfo, name, type, comments, !optional);
  }

  /**
   * @param {MarkdownLiNode} spec
   * @param {string} since
   * @return {{ type: docs.Type, optional: boolean }}
   */
  parseType(spec, since) {
    const arg = parseVariable(spec.text);
    const properties = [];
    for (const child of /** @type {MarkdownLiNode[]} */ (spec.children) || []) {
      const { name, text } = parseVariable(/** @type {string} */(child.text));
      const comments = /** @type {MarkdownNode[]} */ ([{ type: 'text', text }]);
      const childType = this.parseType(child, since);
      properties.push(docs.Member.createProperty({ langs: {}, since, deprecated: undefined, discouraged: undefined }, name, childType.type, comments, !childType.optional));
    }
    const type = docs.Type.parse(arg.type, properties);
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
  while ('?'.includes(remainder[0])) {
    if (remainder[0] === '?')
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
  throw new Error('Should not be reached, line: ' + line);
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
        const { name: argName } = parseVariable(children[0].text || '');
        newChildren.push({
          type: node.type,
          text: name + argName,
          children: [...node.children, ...template.children.map(c => md.clone(c))]
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
      // Insert right after all metadata options like "* since",
      // keeping any additional text like **Usage** below the template.
      let index = node.children.findIndex(child => child.type !== 'li');
      if (index === -1)
        index = 0;
      node.children.splice(index, 0, ...template.children.map(c => md.clone(c)));
    } else if (node.text && node.text.includes('%%-template-')) {
      node.text.replace(/%%-template-[^%]+-%%/, templateName => {
        const template = paramsMap.get(templateName);
        if (!template)
          throw new Error('Bad template: ' + templateName);
        const nodeIndex = parent.children.indexOf(node);
        parent.children = [...parent.children.slice(0, nodeIndex), ...template.children, ...parent.children.slice(nodeIndex + 1)];
      });
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
 * @param {MarkdownHeaderNode} item
 * @returns {MarkdownNode[]}
 */
function extractComments(item) {
  return childrenWithoutProperties(item).filter(c => {
    if (c.type.startsWith('h'))
      return false;
    if (c.type === 'li' && c.liType === 'default')
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
 * @param {MarkdownHeaderNode} spec
 * @returns {import('./documentation').Metainfo & { hidden: boolean }}
 */
function extractMetainfo(spec) {
  return {
    langs: extractLangs(spec),
    since: extractSince(spec),
    deprecated: extractAttribute(spec, 'deprecated'),
    discouraged: extractAttribute(spec, 'discouraged'),
    hidden: extractHidden(spec),
  };
}

/**
 * @param {MarkdownNode} spec
 * @returns {import('./documentation').Langs}
 */
function extractLangs(spec) {
  for (const child of spec.children || []) {
    if (child.type !== 'li' || child.liType !== 'bullet' || !child.text.startsWith('langs:'))
      continue;

    const only = child.text.substring('langs:'.length).trim();
    /** @type {Object<string, string>} */
    const aliases = {};
    for (const p of child.children || []) {
      const match = /** @type {string}*/(p.text).match(/alias-(\w+)[\s]*:(.*)/);
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
 * @param {MarkdownHeaderNode} spec
 * @returns {string}
 */
function extractSince(spec) {
  for (const child of spec.children) {
    if (child.type !== 'li' || child.liType !== 'bullet' || !child.text.startsWith('since:'))
      continue;
    return child.text.substring(child.text.indexOf(':') + 1).trim();
  }
  console.error('Missing since: v1.** declaration in node:');
  console.error(spec);
  process.exit(1);
}

/**
 * @param {MarkdownHeaderNode} spec
 * @returns {boolean}
 */
 function extractHidden(spec) {
  for (const child of spec.children) {
    if (child.type === 'li' && child.liType === 'bullet' && child.text === 'hidden')
      return true;
  }
  return false;
}

/**
 * @param {MarkdownHeaderNode} spec
 * @param {string} name
 * @returns {string | undefined}
 */
 function extractAttribute(spec, name) {
  for (const child of spec.children) {
    if (child.type !== 'li' || child.liType !== 'bullet' || !child.text.startsWith(name + ':'))
      continue;
    return child.text.substring(child.text.indexOf(':') + 1).trim() || undefined;
  }
}

/**
 * @param {MarkdownHeaderNode} spec
 * @returns {MarkdownNode[]}
 */
function childrenWithoutProperties(spec) {
  return (spec.children || []).filter(c => {
    const isProperty = c.type === 'li' && c.liType === 'bullet' && (c.text.startsWith('langs:') || c.text.startsWith('since:') || c.text.startsWith('deprecated:') || c.text.startsWith('discouraged:') || c.text === 'hidden');
    return !isProperty;
  });
}

/**
 * @param {docs.Member} existingMember
 * @param {docs.Member} member
 * @returns {boolean}
 */
function isTypeOverride(existingMember, member) {
  if (!existingMember.langs.only || !member.langs.only)
    return true;
  const existingOnly = existingMember.langs.only;
  if (member.langs.only.every(l => existingOnly.includes(l))) {
    return true;
  } else if (member.langs.only.some(l => existingOnly.includes(l))) {
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
