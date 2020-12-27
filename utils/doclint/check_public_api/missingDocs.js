/**
 * Copyright 2017 Google Inc. All rights reserved.
 * Modifications copyright (c) Microsoft Corporation.
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

const mdBuilder = require('./MDBuilder');
const Message = require('../Message');
const ts = require('typescript');
const EventEmitter = require('events');

/**
 * @return {!Array<!Message>}
 */
module.exports = function lint(api, jsSources, apiFileName) {
  const documentation = mdBuilder(api, true).documentation;
  const apiMethods = listMethods(jsSources, apiFileName);
  const errors = [];
  for (const [className, methodNames] of apiMethods) {
    const docClass = documentation.classes.get(className);
    if (!docClass) {
      errors.push(Message.error(`Missing documentation for "${className}"`));
      continue;
    }
    for (const methodName of methodNames) {
      if (!docClass.members.has(methodName))
        errors.push(Message.error(`Missing documentation for "${className}.${methodName}"`));
    }
  }
  for (const cls of documentation.classesArray) {
    const methods = apiMethods.get(cls.name);
    if (!methods) {
      errors.push(Message.error(`Documented "${cls.name}" not found in sources`));
      continue;
    }
    for (const member of cls.membersArray) {
      if (member.kind !== 'event' && !methods.has(member.name))
        errors.push(Message.error(`Documented "${cls.name}.${member.name}" not found is sources`));
    }
  }
  return errors;
};

/**
 * @param {!Array<!import('../Source')>} sources
 */
function listMethods(sources, apiFileName) {
  const program = ts.createProgram({
    options: {
      allowJs: true,
      target: ts.ScriptTarget.ESNext,
      strict: true
    },
    rootNames: sources.map(source => source.filePath())
  });
  const checker = program.getTypeChecker();
  const apiClassNames = new Set();
  const apiMethods = new Map();
  const apiSource = program.getSourceFiles().find(f => f.fileName === apiFileName);

  /**
   * @param {string} className
   * @param {!ts.Type} classType
   */
  function visitClass(className, classType) {
    let methods = apiMethods.get(className);
    if (!methods) {
      methods = new Set();
      apiMethods.set(className, methods);
    }
    for (const [name, member] of classType.symbol.members || []) {
      if (name.startsWith('_') || name === 'T' || name === 'toString')
        continue;
      if (EventEmitter.prototype.hasOwnProperty(name))
        continue;
      methods.add(name);
    }
    for (const baseType of classType.getBaseTypes() || []) {
      const baseTypeName = baseType.symbol ? baseType.symbol.name : '';
      if (apiClassNames.has(baseTypeName))
        visitClass(className, baseType);
    }
  }

  /**
   * @param {!ts.Node} node
   */
  function visitMethods(node) {
    if (ts.isExportSpecifier(node)) {
      const className = node.name.text;
      const exportSymbol = node.name ? checker.getSymbolAtLocation(node.name) : node.symbol;
      const classType = checker.getDeclaredTypeOfSymbol(exportSymbol);
      if (!classType)
        throw new Error(`Cannot parse class "${className}"`);
      visitClass(className, classType);
    }
    ts.forEachChild(node, visitMethods);
  }

  /**
   * @param {!ts.Node} node
   */
  function visitNames(node) {
    if (ts.isExportSpecifier(node))
      apiClassNames.add(node.name.text);
    ts.forEachChild(node, visitNames);
  }

  visitNames(apiSource);
  visitMethods(apiSource);

  return apiMethods;
}
