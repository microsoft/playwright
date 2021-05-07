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
 * }} DocClass
 */
/** @type {Map<string, DocClass>} */
const classDocumentation = new Map([]);

let currentClass;
/**
 * 
 * @param {Documentation.Class} clazz,
 * @param {string} newName
 */
function registerInterface(clazz, newName) {
  currentClass = newName;
  console.log(`---> DOCS: ${newName}, formerly known as ${clazz.name}`);
}

function registerMember(signature) {
  console.log(`-------> [${currentClass}]:  ${signature} `);
}

module.exports = { registerInterface, registerMember }