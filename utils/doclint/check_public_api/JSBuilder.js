/**
 * Copyright 2019 Google Inc. All rights reserved.
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
const path = require('path');
const Documentation = require('./Documentation');
const EventEmitter = require('events');
module.exports = checkSources;

/**
 * @param {!Array<!import('../Source')>} sources
 */
function checkSources(sources) {
  // special treatment for Events.js
  const classEvents = new Map();
  const eventsSource = sources.find(source => source.name().startsWith('events.'));
  if (eventsSource) {
    const {Events} = eventsSource.filePath().endsWith('.js') ? require(eventsSource.filePath()) : require(path.join(eventsSource.filePath(), '..', '..', '..', 'lib', 'chromium', 'events.js'));
    for (const [className, events] of Object.entries(Events))
      classEvents.set(className, Array.from(Object.values(events)).filter(e => typeof e === 'string').map(e => Documentation.Member.createEvent(e)));
  }

  const excludeClasses = new Set([]);
  const program = ts.createProgram({
    options: {
      allowJs: true,
      target: ts.ScriptTarget.ESNext,
    },
    rootNames: sources.map(source => source.filePath())
  });
  const checker = program.getTypeChecker();
  const sourceFiles = program.getSourceFiles();
  /** @type {!Array<!Documentation.Class>} */
  const classes = [];
  /** @type {!Map<string, string>} */
  const inheritance = new Map();
  sourceFiles.filter(x => !x.fileName.includes('node_modules')).map(x => visit(x));
  const errors = [];
  const documentation = new Documentation(recreateClassesWithInheritance(classes, inheritance));

  return {errors, documentation};

  /**
   * @param {!Array<!Documentation.Class>} classes
   * @param {!Map<string, string>} inheritance
   * @return {!Array<!Documentation.Class>}
   */
  function recreateClassesWithInheritance(classes, inheritance) {
    const classesByName = new Map(classes.map(cls => [cls.name, cls]));
    return classes.map(cls => {
      const membersMap = new Map();
      for (let wp = cls; wp; wp = classesByName.get(inheritance.get(wp.name))) {
        for (const member of wp.membersArray) {
          // Member was overridden.
          const memberId = member.kind + ':' + member.name;
          if (membersMap.has(memberId))
            continue;
          membersMap.set(memberId, member);
        }
      }
      return new Documentation.Class(cls.name, Array.from(membersMap.values()));
    });
  }

  /**
   * @param {!ts.Node} node
   */
  function visit(node) {
    if (ts.isClassDeclaration(node) || ts.isClassExpression(node)) {
      const symbol = node.name ? checker.getSymbolAtLocation(node.name) : node.symbol;
      let className = symbol.getName();

      if (className === '__class') {
        let parent = node;
        while (parent.parent)
          parent = parent.parent;
        className = path.basename(parent.fileName,  '.js');
      }
      if (className && !excludeClasses.has(className)) {
        classes.push(serializeClass(className, symbol, node));
        const parentClassName = parentClass(node);
        if (parentClassName)
          inheritance.set(className, parentClassName);
        excludeClasses.add(className);
      }
    }
    ts.forEachChild(node, visit);
  }

  function parentClass(classNode) {
    for (const herigateClause of classNode.heritageClauses || []) {
      for (const heritageType of herigateClause.types) {
        const parentClassName = heritageType.expression.escapedText;
        return parentClassName;
      }
    }
    return null;

  }

  function serializeSymbol(symbol, circular = []) {
    const type = checker.getTypeOfSymbolAtLocation(symbol, symbol.valueDeclaration);
    const name = symbol.getName();
    if (symbol.valueDeclaration.dotDotDotToken) {
      const innerType = serializeType(type.typeArguments ? type.typeArguments[0] : type, circular);
      innerType.name = '...' + innerType.name;
      return Documentation.Member.createProperty('...' + name, innerType);
    }
    return Documentation.Member.createProperty(name, serializeType(type, circular));
  }

  /**
   * @param {!ts.ObjectType} type
   */
  function isRegularObject(type) {
    if (type.isIntersection())
      return true;
    if (!type.objectFlags)
      return false;
    if (!('aliasSymbol' in type))
      return false;
    if (type.getConstructSignatures().length)
      return false;
    if (type.getCallSignatures().length)
      return false;
    if (type.isUnion())
      return false;
    return true;
  }

  /**
   * @param {!ts.Type} type
   * @return {!Documentation.Type}
   */
  function serializeType(type, circular = []) {
    let typeName = checker.typeToString(type);
    if (typeName === 'any' || typeName === '{ [x: string]: string; }')
      typeName = 'Object';
    const nextCircular = [typeName].concat(circular);

    if (isRegularObject(type)) {
      let properties = undefined;
      if (!circular.includes(typeName))
        properties = type.getProperties().map(property => serializeSymbol(property, nextCircular));
      return new Documentation.Type('Object', properties);
    }
    if (type.isUnion() && (typeName.includes('|') || type.types.every(type => type.isStringLiteral()))) {
      const types = type.types.map(type => serializeType(type, circular));
      const name = types.map(type => type.name).join('|');
      const properties = [].concat(...types.map(type => type.properties));
      return new Documentation.Type(name.replace(/false\|true/g, 'boolean'), properties);
    }
    if (type.typeArguments) {
      const properties = [];
      const innerTypeNames = [];
      for (const typeArgument of type.typeArguments) {
        const innerType = serializeType(typeArgument, nextCircular);
        if (innerType.properties)
          properties.push(...innerType.properties);
        innerTypeNames.push(innerType.name);
      }
      if (innerTypeNames.length === 1 && innerTypeNames[0] === 'void')
        return new Documentation.Type(type.symbol.name);
      return new Documentation.Type(`${type.symbol.name}<${innerTypeNames.join(', ')}>`, properties);
    }
    return new Documentation.Type(typeName, []);
  }

  /**
   * @param {string} className
   * @param {!ts.Symbol} symbol
   * @return {}
   */
  function serializeClass(className, symbol, node) {
    /** @type {!Array<!Documentation.Member>} */
    const members = classEvents.get(className) || [];
    for (const [name, member] of symbol.members || []) {
      if (name.startsWith('_'))
        continue;
      if (EventEmitter.prototype.hasOwnProperty(name))
        continue;
      if (className === 'CDPSession' && name === 'send') {
        // special case CDPSession.send, which has a stricter private API than the public API
        members.push(Documentation.Member.createMethod('send', [
          Documentation.Member.createProperty('method', new Documentation.Type('string')),
          Documentation.Member.createProperty('params', new Documentation.Type('Object')),
        ], new Documentation.Type('Promise<Object>')));
        continue;
      }
      const memberType = checker.getTypeOfSymbolAtLocation(member, member.valueDeclaration);
      const signature = memberType.getCallSignatures()[0];
      if (signature)
        members.push(serializeSignature(name, signature));
      else
        members.push(serializeProperty(name, memberType));
    }

    return new Documentation.Class(className, members);
  }

  /**
   * @param {string} name
   * @param {!ts.Signature} signature
   */
  function serializeSignature(name, signature) {
    const parameters = signature.parameters.map(s => serializeSymbol(s));
    const returnType = serializeType(signature.getReturnType());
    return Documentation.Member.createMethod(name, parameters, returnType.name !== 'void' ? returnType : null);
  }

  /**
   * @param {string} name
   * @param {!ts.Type} type
   */
  function serializeProperty(name, type) {
    return Documentation.Member.createProperty(name, serializeType(type));
  }
}
