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
const { EOL } = require('os');
const path = require('path');
const fs = require('fs');
const md = require('../../../playwright.dev/src/markdown'); // todo: this will probably have to go
const Documentation = require('./documentation');

class MethodWrapper {
/**
 * 
 *  @param {Documentation.Member} method
 *  @param {Documentation.MarkdownNode[]} specs
 *  @param {ArgumentWrapper[]} args
 *  @param {string} returnType
 *  @param {string} name
 * 
 */
  constructor(method, specs, args, returnType, name) {
    this.method = method;
    this.specs = specs;
    this.args = args;
    this.returnType = returnType;
    this.name = name;
    this.isAsync = method.async;
  }

  getSignature = function() {
    let argTypes = [];
    this.args.forEach(a => {
      // this isn't pretty, but it's what we got  
      /** @type {string} */
      let sig = a.signature;
      let name = a.name;
      let type = sig.substr(0, sig.indexOf(name));
      argTypes.push(type.trim());
    });
    return `${this.name}(${argTypes.join(', ')})`;
  }
}

/**
 * @typedef {{
 *   name: string,
 *   specs: Documentation.MarkdownNode[],
 *   members: MethodWrapper[],
 *   parents: string[]
 * }} DocClass
 */

/** 
 * @typedef {{
 *  arg: Documentation.Member,
 *  docs: string[],
 *  signature: string,
 *  name: string
 * }} ArgumentWrapper
 */

/** @type {Map<string, DocClass>} */
const classDocumentation = new Map([]);

/** @type {DocClass} */
let currentClass;
/**
 * 
 * @param {Documentation.Class} clazz,
 * @param {string} newName
 */
function registerInterface(clazz, newName) {
  let specs = clazz
    .spec
    .filter(x => !x.codeLang || x.codeLang === 'csharp')
    .filter(x => !(x.text || '').startsWith("extends: [EventEmitter]"));

  /** @type {DocClass} */
  let wrapper = {
    name: newName,
    specs: specs,
    members: [],
    parents: []
  };
  currentClass = wrapper;
  classDocumentation.set(newName, wrapper);
}

/**
 * 
 * @param {Documentation.Member} member 
 * @param {string} name
 * @param {string} returnType 
 * @param {Map<string, ArgumentWrapper>} paramsMap
 */
function registerMethod(member, name, returnType, paramsMap) {
  if (!currentClass)
    throw new Error("Parent is null.");

  /**  @type {MethodWrapper} */
  let method = new MethodWrapper(
    member,
    member.spec,
    [],
    returnType,
    name);

  paramsMap.forEach((x, name) => method.args.push({
    arg: x.arg,
    name: name,
    docs: x.docs,
    signature: x.signature
  }));

  if (member.async)
    name = "Async " + name;
  currentClass.members.push(method);
}

/**
 * @param {string} name
 * @param {string} type
 * @param {boolean} isSettable
 * @param {Documentation.Class | Documentation.Type} parent
 */
function registerProperty(name, type, isSettable, parent) {
  if (!currentClass)
    throw new Error("No parent.");
  // currentClass.members.push(`${parent.name}::::${type} ${name} { get; set; /* ${isSettable} */ }`);
}

function registerInheritance(parent) {
  if (!parent) return;
  currentClass.parents.push(parent);
}

function renderDocumentation(folder) {
  fs.mkdirSync(folder, { recursive: true });
  let writeFile = (name, out, folder) => {
    let content = out.join(`${EOL}`);
    fs.writeFileSync(path.join(folder, name), content);
  }

  classDocumentation.forEach((docClass, name) => {
    const fileName = `class-${docClass.name.toLowerCase()}.mdx`;
    let buffer = [];

    buffer.push(`---
id: class-${name.toLowerCase()}
title: "${name}"
---
import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';
`);

    buffer.push(md.render(docClass.specs));

    let membersBuffer = [];
    // generate TOC 
    docClass.members.forEach(member => {
      let signature = member.getSignature();
      let linkName = signature.toLowerCase().split(',').map(c => c.replace(/[^a-z_]/g, '')).join('');

      let prefix = '';
      if(member.method.async)
        prefix +='async ';
      
      prefix += `${member.returnType} `;

      buffer.push(`- [${prefix}${signature}]('./api/${fileName}#${linkName})`);
      membersBuffer.push(`## ${member}`);
    });

    buffer.push(...membersBuffer);

    writeFile(fileName, buffer, folder);
  });
}

module.exports = { registerInterface, registerMethod, renderDocumentation, registerInheritance, registerProperty }