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

const { parseArgument } = require('../../parse_md');
const Documentation = require('./Documentation');

/** @typedef {import('./Documentation').MarkdownNode} MarkdownNode */

class MDOutline {
  /**
   * @param {MarkdownNode[]} api
   */
  constructor(api) {
    this.classesArray = /** @type {Documentation.Class[]} */ [];
    this.classes = /** @type {Map<string, Documentation.Class>} */ new Map();
    for (const clazz of api) {
      const c = parseClass(clazz);
      this.classesArray.push(c);
      this.classes.set(c.name, c);
    }
    this.signatures = this._generateComments();
  }

  _generateComments() {
    /**
     * @type  {Map<string, string>}
     */
    const signatures = new Map();

    for (const clazz of this.classesArray) {
      for (const method of clazz.methodsArray) {
        const tokens = [];
        let hasOptional = false;
        for (const arg of method.argsArray) {
          const optional = !arg.required;
          if (tokens.length) {
            if (optional && !hasOptional)
              tokens.push(`[, ${arg.name}`);
            else
              tokens.push(`, ${arg.name}`);
          } else {
            if (optional && !hasOptional)
              tokens.push(`[${arg.name}`);
            else
              tokens.push(`${arg.name}`);
          }
          hasOptional = hasOptional || optional;
        }
        if (hasOptional)
          tokens.push(']');
        const signature = tokens.join('');
        const methodName = `${clazz.name}.${method.name}`;
        signatures.set(methodName, signature);
      }
    }

    for (const clazz of this.classesArray)
      clazz.visit(item => item.comment = renderComments(item.spec, signatures));
    return signatures;
  }
}

/**
 * @param {MarkdownNode} node
 * @returns {Documentation.Class}
 */
function parseClass(node) {
  const members = [];
  let extendsName = null;
  const name = node.text.substring('class: '.length);
  for (const member of node.children) {
    if (member.type === 'li' && member.text.startsWith('extends: [')) {
      extendsName = member.text.substring('extends: ['.length, member.text.indexOf(']'));
      continue;
    }
    if (member.type === 'h2')
      members.push(parseMember(member));
  }
  return new Documentation.Class(name, members, extendsName, extractComments(node));
}

/**
 * @param {MarkdownNode} item
 * @returns {MarkdownNode[]}
 */
function extractComments(item) {
  return (item.children || []).filter(c => c.type !== 'gen' && !c.type.startsWith('h'));
}

/**
 * @param {MarkdownNode[]} spec
 * @param {Map<string, string>} [signatures]
 */
function renderComments(spec, signatures) {
  const result = [];
  for (const node of spec || []) {
    if (node.type === 'text') {
      const text = patchSignatures(node.text, signatures);

      // Render comments as text.
      if (text.startsWith('> ')) {
        result.push('');
        result.push(text);
      } else {
        result.push(text);
      }
    }
  
    if (node.type === 'code') {
      result.push('```' + node.codeLang);
      for (const line of node.lines)
        result.push(line);
      result.push('```');
    }
  
    if (node.type === 'gen') {
      // Skip
    }
  
    if (node.type === 'li' && node.liType !== 'default') {
      if (node.text.startsWith('extends:'))
        continue;
      const visit = (node, indent) => {
        result.push(`${indent}- ${patchSignatures(node.text, signatures)}`);
        for (const child of node.children || [])
          visit(child, indent + '  ');
      };
      visit(node, '');
    }
  }
  return result.join('\n');
}

/**
 * @param {string} comment
 * @param {Map<string, string>} signatures
 */
function patchSignatures(comment, signatures) {
  if (!signatures)
    return comment;
  comment = comment.replace(/\[`(event|method|property):\s(JS|CDP|[A-Z])([^.]+)\.([^`]+)`\]\(\)/g, (match, type, clazzPrefix, clazz, name) => {
    const className = `${clazzPrefix.toLowerCase()}${clazz}`;
    if (type === 'event')
      return `\`${className}.on('${name}')\``;
    if (type === 'method') {
      const signature = signatures.get(`${clazzPrefix}${clazz}.${name}`) || '';
      return `\`${className}.${name}(${signature})\``;
    }
    return `\`${className}.${name}\``;
  });
  comment = comment.replace(/\[`(?:param|option):\s([^`]+)`\]\(\)/g, '`$1`');
  comment = comment.replace(/\[([^\]]+)\]\([^\)]*\)/g, '$1');
  for (const link of outgoingLinks)
    comment = comment.replace(new RegExp('\\[' + link + '\\]', 'g'), link);
  return comment;
}

/**
 * @param {MarkdownNode} member
 * @returns {Documentation.Member}
 */
function parseMember(member) {
  const args = [];
  const match = member.text.match(/(event|method|property|async method|): (JS|CDP|[A-Z])([^.]+)\.(.*)/);
  const name = match[4];
  let returnType = null;
  const options = [];

  for (const item of member.children || []) {
    if (item.type === 'li' && item.liType === 'default')
      returnType = parseType(item);
  }
  if (!returnType)
    returnType = new Documentation.Type('void');
  if (match[1] === 'async method')
    returnType.name = `Promise<${returnType.name}>`;

  if (match[1] === 'event')
    return Documentation.Member.createEvent(name, returnType, extractComments(member));
  if (match[1] === 'property')
    return Documentation.Member.createProperty(name, returnType, extractComments(member), true);

  for (const item of member.children || []) {
    if (item.type === 'h3' && item.text.startsWith('param:'))
      args.push(parseProperty(item));
    if (item.type === 'h3' && item.text.startsWith('option:'))
      options.push(parseProperty(item));
  }

  if (options.length) {
    options.sort((o1, o2) => o1.name.localeCompare(o2.name));
    for (const option of options)
       option.required = false;
    const type = new Documentation.Type('Object', options);
    args.push(Documentation.Member.createProperty('options', type, undefined, false));
  }
  return Documentation.Member.createMethod(name, args, returnType, extractComments(member));
}

/**
 * @param {MarkdownNode} spec
 * @return {Documentation.Member}
 */
function parseProperty(spec) {
  const param = spec.children[0];
  const text = param.text;
  const name = text.substring(0, text.indexOf('<')).replace(/\`/g, '').trim();
  const comments = extractComments(spec);
  return Documentation.Member.createProperty(name, parseType(param), comments, guessRequired(renderComments(comments)));
}

/**
 * @param {MarkdownNode=} spec
 * @return {Documentation.Type}
 */
function parseType(spec) {
  const { type } = parseArgument(spec.text);
  let typeName = type.replace(/[\[\]\\]/g, '');
  const literals = typeName.match(/("[^"]+"(\|"[^"]+")*)/);
  if (literals) {
    const sorted = literals[1].split('|').sort((a, b) => a.localeCompare(b)).join('|');
    typeName = typeName.substring(0, literals.index) + sorted + typeName.substring(literals.index + literals[0].length);
  }
  const properties = [];
  const hasNonEnumProperties = typeName.split('|').some(part => {
    const basicTypes = new Set(['string', 'number', 'boolean']);
    const arrayTypes = new Set([...basicTypes].map(type => `Array<${type}>`));
    return !basicTypes.has(part) && !arrayTypes.has(part) && !(part.startsWith('"') && part.endsWith('"'));
  });
  if (hasNonEnumProperties && spec) {
    for (const child of spec.children || []) {
      const { name, text } = parseArgument(child.text);
      const patchedText = text.replace(/\. Optional\.$/, '.');
      const comments = /** @type {MarkdownNode[]} */ ([{ type: 'text', text: patchedText }]);
      properties.push(Documentation.Member.createProperty(name, parseType(child), comments, guessRequired(text)));
    }
  }
  return new Documentation.Type(typeName, properties);
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
  if (comment.includes('**required**'))
    required = true;
  return required;
}

module.exports =
/**
 * @param {any} api
 * @param {boolean} copyDocsFromSuperClasses
 */
 function(api, copyDocsFromSuperClasses) {
  const errors = [];
  const outline = new MDOutline(api);
  const documentation = new Documentation(outline.classesArray);

  if (copyDocsFromSuperClasses) {
    // Push base class documentation to derived classes.
    for (const [name, clazz] of documentation.classes.entries()) {
      clazz.validateOrder(errors, clazz);

      if (!clazz.extends || clazz.extends === 'EventEmitter' || clazz.extends === 'Error')
        continue;
      const superClass = documentation.classes.get(clazz.extends);
      if (!superClass) {
        errors.push(`Undefined superclass: ${superClass} in ${name}`);
        continue;
      }
      for (const memberName of clazz.members.keys()) {
        if (superClass.members.has(memberName))
          errors.push(`Member documentation overrides base: ${name}.${memberName} over ${clazz.extends}.${memberName}`);
      }

      clazz.membersArray = [...clazz.membersArray, ...superClass.membersArray];
      clazz.index();
    }
  }
  return { documentation, errors, outline };
};

const outgoingLinks = ['AXNode', 'Accessibility', 'Array', 'Body', 'BrowserServer', 'BrowserContext', 'BrowserType', 'Browser', 'Buffer', 'ChildProcess', 'ChromiumBrowser', 'ChromiumBrowserContext', 'ChromiumCoverage', 'CDPSession', 'ConsoleMessage', 'Dialog', 'Download', 'ElementHandle', 'Element', 'Error', 'EvaluationArgument', 'File', 'FileChooser', 'FirefoxBrowser', 'Frame', 'JSHandle', 'Keyboard', 'Logger', 'Map', 'Mouse', 'Object', 'Page', 'Playwright', 'Promise', 'RegExp', 'Request', 'Response', 'Route', 'Selectors', 'Serializable', 'TimeoutError', 'Touchscreen', 'UIEvent.detail', 'URL', 'USKeyboardLayout', 'UnixTime', 'Video', 'WebKitBrowser', 'WebSocket', 'Worker', 'boolean', 'function', 'iterator', 'null', 'number', 'origin', 'selector', 'Readable', 'string', 'xpath'];