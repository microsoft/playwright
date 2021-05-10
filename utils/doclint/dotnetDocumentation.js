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

const Documentation = require('./documentation');

/**
 * @typedef {{
 *   name: string,
 *   specs: Documentation.MarkdownNode[],
 *   members: string[],
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
  /** @type {DocClass} */
  let wrapper = {
    name: newName,
    specs: clazz.spec,
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

  let args = [];
  paramsMap.forEach(x => args.push(x.signature));
  if(member.async)
    name = "Async " + name;
  currentClass.members.push(`${returnType} ${name}(${ args.join(', ')})`);
}

function getDocumentation() {
  return classDocumentation;
}

function registerInheritance(parent) {
  if (!parent) return;
  currentClass.parents.push(parent);
}

module.exports = { registerInterface, registerMethod, getDocumentation, registerInheritance }