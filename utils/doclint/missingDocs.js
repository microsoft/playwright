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

const ts = require('typescript');
const EventEmitter = require('events');
const Documentation = require('./documentation');
const path = require('path');

/** @typedef {import('../../markdown').MarkdownNode} MarkdownNode */

const IGNORE_CLASSES = ['PlaywrightAssertions', 'GenericAssertions', 'LocatorAssertions', 'PageAssertions', 'APIResponseAssertions', 'SnapshotAssertions'];

module.exports = function lint(documentation, jsSources, apiFileName) {
  const errors = [];
  documentation.copyDocsFromSuperclasses(errors);
  const apiMethods = listMethods(jsSources, apiFileName);
  for (const [className, methods] of apiMethods) {
    const docClass = documentation.classes.get(className);
    if (!docClass) {
      errors.push(`Missing documentation for "${className}"`);
      continue;
    }
    for (const [methodName, params] of methods) {
      const members = docClass.membersArray.filter(m => m.alias === methodName && m.kind !== 'event');
      if (!members.length) {
        errors.push(`Missing documentation for "${className}.${methodName}"`);
        continue;
      }
      for (const paramName of params) {
        const found = members.some(member => paramsForMember(member).has(paramName));
        if (!found)
          errors.push(`Missing documentation for "${className}.${methodName}.${paramName}"`);
      }
    }
  }
  for (const cls of documentation.classesArray) {
    if (IGNORE_CLASSES.includes(cls.name))
      continue;
    const methods = apiMethods.get(cls.name);
    if (!methods) {
      errors.push(`Documented "${cls.name}" not found in sources`);
      continue;
    }
    for (const member of cls.membersArray) {
      if (member.kind === 'event' || member.alias === 'removeAllListeners')
        continue;
      const params = methods.get(member.alias);
      if (!params) {
        errors.push(`Documented "${cls.name}.${member.alias}" not found in sources`);
        continue;
      }
      const memberParams = paramsForMember(member);
      for (const paramName of memberParams) {
        if (!params.has(paramName) && paramName !== 'options')
          errors.push(`Documented "${cls.name}.${member.alias}.${paramName}" not found in sources`);
      }
    }
  }
  return errors;
};

/**
 * @param {!Documentation.Member} member
 */
function paramsForMember(member) {
  if (member.kind !== 'method')
    return new Set();
  return new Set(member.argsArray.map(a => a.alias));
}

/**
 * @param {string[]} rootNames
 */
function listMethods(rootNames, apiFileName) {
  const program = ts.createProgram({
    options: {
      allowJs: true,
      target: ts.ScriptTarget.ESNext,
      strict: true
    },
    rootNames
  });
  const checker = program.getTypeChecker();
  const apiClassNames = new Set();
  const apiMethods = new Map();
  const apiSource = program.getSourceFiles().find(f => f.fileName === apiFileName.split(path.sep).join(path.posix.sep));
  /**
   * @param {ts.Type} type
   */
  function signatureForType(type) {
    const signatures = type.getCallSignatures();
    if (signatures.length)
      return signatures[signatures.length - 1];
    if (type.isUnion()) {
      const innerTypes = type.types.filter(t => !(t.flags & ts.TypeFlags.Undefined));
      if (innerTypes.length === 1)
        return signatureForType(innerTypes[0]);
    }
    return null;
  }

  /**
   * @param {string} className
   * @param {string} methodName
   */
  function shouldSkipMethodByName(className, methodName) {
    if (methodName.startsWith('_') || methodName === 'T' || methodName === 'toString')
      return true;
    if (/** @type {any} */(EventEmitter).prototype.hasOwnProperty(methodName))
      return true;
    return false;
  }

  /**
   * @param {string} className
   * @param {!ts.Type} classType
   */
  function visitClass(className, classType) {
    let methods = apiMethods.get(className);
    if (!methods) {
      methods = new Map();
      apiMethods.set(className, methods);
    }
    for (const [name, member] of /** @type {any[]} */(classType.symbol.members || [])) {
      if (shouldSkipMethodByName(className, name))
        continue;
      const memberType = checker.getTypeOfSymbolAtLocation(member, member.valueDeclaration);
      const signature = signatureForType(memberType);
      if (signature)
        methods.set(name, new Set(signature.parameters.map(p => p.escapedName)));
      else
        methods.set(name, new Set());
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
      const exportSymbol = node.name ? checker.getSymbolAtLocation(node.name) : /** @type {any} */ (node).symbol;
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
