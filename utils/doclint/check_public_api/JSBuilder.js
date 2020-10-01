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
module.exports = { checkSources };

/**
 * @param {!Array<!import('../Source')>} sources
 */
function checkSources(sources) {
  // special treatment for Events.js
  const classEvents = new Map();
  const eventsSources = sources.filter(source => source.name().startsWith('events.'));
  for (const eventsSource of eventsSources) {
    const {Events} = require(eventsSource.filePath().endsWith('.js') ? eventsSource.filePath() : eventsSource.filePath().replace(/\bsrc\b/, 'lib').replace('.ts', '.js'));
    for (const [className, events] of Object.entries(Events))
      classEvents.set(className, Array.from(Object.values(events)).filter(e => typeof e === 'string').map(e => Documentation.Member.createEvent(e)));
  }

  const excludeClasses = new Set([]);
  const program = ts.createProgram({
    options: {
      allowJs: true,
      target: ts.ScriptTarget.ESNext,
      strict: true
    },
    rootNames: sources.map(source => source.filePath())
  });
  const checker = program.getTypeChecker();
  const sourceFiles = program.getSourceFiles();
  const errors = [];
  const apiClassNames = new Set();
  /** @type {!Array<!Documentation.Class>} */
  const classes = [];
  /** @type {!Map<string, string[]>} */
  const inheritance = new Map();
  sourceFiles.filter(x => !x.fileName.includes('node_modules')).map(x => visit(x));
  const documentation = new Documentation(recreateClassesWithInheritance(classes, inheritance).filter(cls => apiClassNames.has(cls.name)));

  return {errors, documentation};

  /**
   * @param {!Array<!Documentation.Class>} classes
   * @param {!Map<string, string[]>} inheritance
   * @return {!Array<!Documentation.Class>}
   */
  function recreateClassesWithInheritance(classes, inheritance) {
    const classesByName = new Map(classes.map(cls => [cls.name, cls]));
    return classes.map(cls => {
      const membersMap = new Map();
      const visit = cls => {
        if (!cls)
          return;
        for (const member of cls.membersArray) {
          // Member was overridden.
          const memberId = member.kind + ':' + member.name;
          if (membersMap.has(memberId))
            continue;
          membersMap.set(memberId, member);
        }
        const parents = inheritance.get(cls.name) || [];
        for (const parent of parents)
          visit(classesByName.get(parent));
      };
      visit(cls);
      return new Documentation.Class(cls.name, Array.from(membersMap.values()), undefined, cls.comment, cls.templates);
    });
  }

  /**
   * @param {!ts.Node} node
   */
  function visit(node) {
    const fileName = node.getSourceFile().fileName;
    if (ts.isClassDeclaration(node) || ts.isClassExpression(node) || ts.isInterfaceDeclaration(node)) {
      const symbol = node.name ? checker.getSymbolAtLocation(node.name) : node.symbol;
      let className = symbol.getName();

      if (className === '__class') {
        let parent = node;
        while (parent.parent)
          parent = parent.parent;
        className = path.basename(parent.fileName,  '.js');
      }
      if (className && !excludeClasses.has(className) && !fileName.endsWith('/protocol.ts')) {
        excludeClasses.add(className);
        classes.push(serializeClass(className, symbol, node));
        inheritance.set(className, parentClasses(node));
      }
    }
    if (fileName.endsWith('/api.ts') && ts.isExportSpecifier(node))
      apiClassNames.add((node.propertyName || node.name).text);
    ts.forEachChild(node, visit);
  }

  function parentClasses(classNode) {
    const parents = [];
    for (const herigateClause of classNode.heritageClauses || []) {
      for (const heritageType of herigateClause.types) {
        let expression = heritageType.expression;
        if (expression.kind === ts.SyntaxKind.PropertyAccessExpression)
          expression = expression.name;
        if (classNode.name.escapedText !== expression.escapedText)
          parents.push(expression.escapedText);
      }
    }
    return parents;
  }

  /**
   * @param {ts.Symbol} symbol
   * @param {string[]=} circular
   * @param {boolean=} parentRequired
   */
  function serializeSymbol(symbol, circular = [], parentRequired = true) {
    const type = checker.getTypeOfSymbolAtLocation(symbol, symbol.valueDeclaration);
    const name = symbol.getName();
    if (symbol.valueDeclaration && symbol.valueDeclaration.dotDotDotToken) {
      const innerType = serializeType(type.typeArguments ? type.typeArguments[0] : type, circular);
      innerType.name = '...' + innerType.name;
      const required = false;
      return Documentation.Member.createProperty('...' + name, innerType, undefined, required);
    }

    const required = parentRequired && !typeHasUndefined(type);
    return Documentation.Member.createProperty(name, serializeType(type, circular), undefined, required);
  }

  /**
   * @param {!ts.Type} type
   */
  function typeHasUndefined(type) {
    if (!type.isUnion())
      return type.flags & ts.TypeFlags.Undefined;
    return type.types.some(typeHasUndefined);
  }

  /**
   * @param {!ts.Type} type
   */
  function isNotUndefined(type) {
     return !(type.flags & ts.TypeFlags.Undefined);
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
    let typeName = checker.typeToString(type).replace(/SmartHandle/g, 'Handle');
    if (typeName === 'any')
      typeName = 'Object';
    const nextCircular = [typeName].concat(circular);
    const stringIndexType = type.getStringIndexType();
    if (stringIndexType) {
      return new Documentation.Type(`Object<string, ${serializeType(stringIndexType, circular).name}>`);
    } else if (isRegularObject(type)) {
      let properties = undefined;
      if (!circular.includes(typeName))
        properties = getTypeProperties(type).map(property => serializeSymbol(property, nextCircular));
      return new Documentation.Type('Object', properties);
    }
    if (type.isUnion() && (typeName.includes('|') || type.types.every(type => type.isStringLiteral() || type.intrinsicName === 'number'))) {
      const types = type.types.filter(isNotUndefined).map((type, index) => {
        return { isLiteral: type.isStringLiteral(), serialized: serializeType(type, circular), index };
      });
      types.sort((a, b) => {
        if (!a.isLiteral || !b.isLiteral)
          return a.index - b.index;
        return a.serialized.name.localeCompare(b.serialized.name);
      });
      const name = types.map(type => type.serialized.name).join('|');
      const properties = [].concat(...types.map(type => type.serialized.properties));
      return new Documentation.Type(name.replace(/false\|true/g, 'boolean'), properties);
    }
    if (type.typeArguments && type.symbol) {
      const properties = [];
      const innerTypeNames = [];
      for (const typeArgument of type.typeArguments) {
        const innerType = serializeType(typeArgument, nextCircular);
        if (innerType.properties)
          properties.push(...innerType.properties);
        innerTypeNames.push(innerType.name);
      }
      if (innerTypeNames.length === 0 || (innerTypeNames.length === 1 && innerTypeNames[0] === 'void'))
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
    const templates = [];
    for (const [name, member] of symbol.members || []) {
      if (className === 'Error')
        continue;
      if (name.startsWith('_'))
        continue;
      if (member.valueDeclaration && ts.getCombinedModifierFlags(member.valueDeclaration) & ts.ModifierFlags.Private)
        continue;
      if (EventEmitter.prototype.hasOwnProperty(name))
        continue;
      const memberType = checker.getTypeOfSymbolAtLocation(member, member.valueDeclaration);
      const signature = signatureForType(memberType);
      if (member.flags & ts.SymbolFlags.TypeParameter)
        templates.push(name);
      else if (signature)
        members.push(serializeSignature(name, signature));
      else
        members.push(serializeProperty(name, memberType));
    }

    return new Documentation.Class(className, members, undefined, undefined, templates);
  }

  /**
   * @param {ts.Type} type
   */
  function signatureForType(type) {
    const signatures = type.getCallSignatures();
    if (signatures.length)
      return signatures[signatures.length - 1];
    if (type.isUnion()) {
      const innerTypes = type.types.filter(isNotUndefined);
      if (innerTypes.length === 1)
        return signatureForType(innerTypes[0]);
    }
    return null;
  }

  /**
   * @param {string} name
   * @param {!ts.Signature} signature
   */
  function serializeSignature(name, signature) {
    const minArgumentCount = signature.minArgumentCount || 0;
    const parameters = signature.parameters.map((s, index) => serializeSymbol(s, [], index < minArgumentCount));
    const templates = signature.typeParameters ? signature.typeParameters.map(t => t.symbol.name) : [];
    const returnType = serializeType(signature.getReturnType());
    return Documentation.Member.createMethod(name, parameters, returnType.name !== 'void' ? returnType : null, undefined, undefined, templates);
  }

  /**
   * @param {string} name
   * @param {!ts.Type} type
   */
  function serializeProperty(name, type) {
    return Documentation.Member.createProperty(name, serializeType(type));
  }

  /**
   * @param {!ts.Type} type
   */
  function getTypeProperties(type) {
    if (type.aliasSymbol && type.aliasSymbol.escapedName === 'Pick') {
      const props = getTypeProperties(type.aliasTypeArguments[0]);
      const pickNames = type.aliasTypeArguments[1].types.map(t => t.value);
      return props.filter(p => pickNames.includes(p.getName()));
    }
    if (!type.isIntersection())
      return type.getProperties();
    let props = [];
    for (const innerType of type.types) {
      let innerProps = getTypeProperties(innerType);
      props = props.filter(p => !innerProps.find(e => e.getName() === p.getName()));
      props = props.filter(p => p.getName() !== '_tracePath' && p.getName() !== '_traceResourcesPath');
      props.push(...innerProps);
    }
    return props;
  }
}
