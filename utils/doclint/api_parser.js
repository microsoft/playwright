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
   */
  constructor(apiDir) {
    let bodyParts = [];
    let paramsPath;
    for (const name of fs.readdirSync(apiDir)) {
      if (name === 'params.md')
        paramsPath = path.join(apiDir, name);
      else
        bodyParts.push(fs.readFileSync(path.join(apiDir, name)).toString());
    }
    const body = md.parse(bodyParts.join('\n'));
    const params = paramsPath ? md.parse(fs.readFileSync(paramsPath).toString()) : null;
    const api = params ? applyTemplates(body, params) : body;
    /** @type {Map<string, Documentation.Class>} */
    this.classes = new Map();
    md.visitAll(api, node => {
      if (node.type === 'h1')
        this.parseClass(node);
      if (node.type === 'h2')
        this.parseMember(node);
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
    for (const item of spec.children || []) {
      if (item.type === 'li' && item.liType === 'default')
        returnType = this.parseType(item);
    }
    if (!returnType)
      returnType = new Documentation.Type('void');

    let member;
    if (match[1] === 'event')
      member = Documentation.Member.createEvent(extractLangs(spec), name, returnType, extractComments(spec));
    if (match[1] === 'property')
      member = Documentation.Member.createProperty(extractLangs(spec), name, returnType, extractComments(spec));
    if (match[1] === 'method' || match[1] === 'async method') {
      member = Documentation.Member.createMethod(extractLangs(spec), name, [], returnType, extractComments(spec));
      if (match[1] === 'async method')
        member.async = true;
    }
    const clazz = this.classes.get(match[2]);
    const existingMember = clazz.membersArray.find(m => m.name === name && m.kind === "method");
    if (existingMember) {
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
    const match = spec.text.match(/(param|option): ([^.]+)\.([^.]+)\.(.*)/);
    if(!match)
      throw `Something went wrong with matching ${spec.text}`;
    const clazz = this.classes.get(match[2]);
    if (!clazz)
      throw new Error('Invalid class ' + match[2]);
    const method = clazz.membersArray.find(m => m.kind === 'method' && m.alias === match[3]);
    if (!method)
      throw new Error('Invalid method ' + match[2] + '.' + match[3]);
    const name = match[4];
    if (!name)
      throw new Error('Invalid member name ' + spec.text);
    if (match[1] === 'param') {
      const arg = this.parseProperty(spec);
      arg.name = name;
      const existingArg = method.argsArray.find(m => m.name === arg.name);
      if (existingArg) {
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
    const name = text.substring(0, text.indexOf('<')).replace(/\`/g, '').trim();
    const comments = extractComments(spec);
    return Documentation.Member.createProperty(extractLangs(spec), name, this.parseType(param), comments, guessRequired(md.render(comments)));
  }

  /**
   * @param {MarkdownNode=} spec
   * @return {Documentation.Type}
   */
  parseType(spec) {
    const arg = parseVariable(spec.text);
    const properties = [];
    for (const child of spec.children || []) {
      const { name, text } = parseVariable(child.text);
      const comments = /** @type {MarkdownNode[]} */ ([{ type: 'text', text }]);
      properties.push(Documentation.Member.createProperty({}, name, this.parseType(child), comments, guessRequired(text)));
    }
    return Documentation.Type.parse(arg.type, properties);
  }
}

/**
 * @param {string} line 
 * @returns {{ name: string, type: string, text: string }}
 */
function parseVariable(line) {
  let match = line.match(/^`([^`]+)` (.*)/);
  if (!match)
    match = line.match(/^(returns): (.*)/);
  if (!match)
    match = line.match(/^(type): (.*)/);
  if (!match)
    throw new Error('Invalid argument: ' + line);
  const name = match[1];
  const remainder = match[2];
  if (!remainder.startsWith('<'))
    throw new Error('Bad argument: ' + remainder);
  let depth = 0;
  for (let i = 0; i < remainder.length; ++i) {
    const c = remainder.charAt(i);
    if (c === '<')
      ++depth;
    if (c === '>')
      --depth;
    if (depth === 0)
      return { name, type: remainder.substring(1, i), text: remainder.substring(i + 2) };
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
      if (!list)
        throw new Error('Bad template: ' + key);
      for (const prop of list.children) {
        const template = paramsMap.get(prop.text);
        if (!template)
          throw new Error('Bad template: ' + prop.text);
        const children = childrenWithoutProperties(template);
        const { name: argName } = parseVariable(children[0].text);
        parent.children.push({
          type: node.type,
          text: name + argName,
          children: template.children.map(c => md.clone(c))
        });
      }
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
 * @param {string} comment
 */
function guessRequired(comment) {
  let required = true;
  if (comment.toLowerCase().includes('defaults to '))
    required = false;
  if (comment.startsWith('Optional'))
    required = false;
  if (comment.endsWith('Optional.'))
    required = false;
  if (comment.toLowerCase().includes('if set'))
    required = false;
  if (comment.toLowerCase().includes('if applicable'))
    required = false;
  if (comment.toLowerCase().includes('if available'))
    required = false;
  return required;
}

/**
 * @param {string} apiDir
 */
function parseApi(apiDir) {
  return new ApiParser(apiDir).documentation;
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
      only: only ? only.split(',') : undefined,
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

module.exports = { parseApi };
