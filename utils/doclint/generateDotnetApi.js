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

const path = require('path');
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const Documentation = require('./documentation');
const XmlDoc = require('./dotnetXmlDocumentation');
const PROJECT_DIR = path.join(__dirname, '..', '..');
const fs = require('fs');
const { parseApi } = require('./api_parser');
const { Type } = require('./documentation');
const { EOL } = require('os');

const maxDocumentationColumnWidth = 80;
Error.stackTraceLimit = 100;

/** @type {Map<string, Documentation.Type>} */
const modelTypes = new Map(); // this will hold types that we discover, because of .NET specifics, like results
/** @type {Map<string, string>} */
const documentedResults = new Map(); // will hold documentation for new types
/** @type {Map<string, string[]>} */
const enumTypes = new Map();
/** @type {Map<string, Documentation.Type>} */
const optionTypes = new Map();
const customTypeNames = new Map([
  ['domcontentloaded', 'DOMContentLoaded'],
  ['networkidle', 'NetworkIdle'],
]);

const outputDir = process.argv[2] || path.join(__dirname, 'generate_types', 'csharp');
const apiDir = path.join(outputDir, 'API', 'Generated');
const optionsDir = path.join(outputDir, 'API', 'Generated', 'Options');
const enumsDir = path.join(outputDir, 'API', 'Generated', 'Enums');
const typesDir = path.join(outputDir, 'API', 'Generated', 'Types');

for (const dir of [apiDir, optionsDir, enumsDir, typesDir])
  fs.mkdirSync(dir, { recursive: true });

const documentation = parseApi(path.join(PROJECT_DIR, 'docs', 'src', 'api'));
documentation.filterForLanguage('csharp');

documentation.setLinkRenderer(item => {
  const asyncSuffix = item.member && item.member.async ? 'Async' : '';
  if (item.clazz)
    return `<see cref="I${toTitleCase(item.clazz.name)}"/>`;
  else if (item.member)
    return `<see cref="I${toTitleCase(item.member.clazz.name)}.${toMemberName(item.member)}${asyncSuffix}"/>`;
  else if (item.option)
    return `<paramref name="${item.option}"/>`;
  else if (item.param)
    return `<paramref name="${item.param}"/>`;
  else
    throw new Error('Unknown link format.');
});

// get the template for a class
const template = fs.readFileSync(path.join(__dirname, 'templates', 'interface.cs'), 'utf-8');

// map the name to a C# friendly one (we prepend an I to denote an interface)
const classNameMap = new Map(documentation.classesArray.map(x => [x.name, `I${toTitleCase(x.name)}`]));

// map some types that we know of
classNameMap.set('Error', 'Exception');
classNameMap.set('TimeoutError', 'TimeoutException');
classNameMap.set('EvaluationArgument', 'object');
classNameMap.set('boolean', 'bool');
classNameMap.set('any', 'object');
classNameMap.set('Buffer', 'byte[]');
classNameMap.set('path', 'string');
classNameMap.set('Date', 'DateTime');
classNameMap.set('URL', 'string');
classNameMap.set('RegExp', 'Regex');
classNameMap.set('Readable', 'Stream');

/**
 *
 * @param {string} kind
 * @param {string} name
 * @param {Documentation.MarkdownNode[]|null} spec
 * @param {string[]} body
 * @param {string} folder
 * @param {string|null} extendsName
 */
function writeFile(kind, name, spec, body, folder, extendsName = null) {
  const out = [];
  // console.log(`Generating ${name}`);

  if (spec) {
    out.push(...XmlDoc.renderXmlDoc(spec, maxDocumentationColumnWidth));
  } else {
    const ownDocumentation = documentedResults.get(name);
    if (ownDocumentation) {
      out.push('/// <summary>');
      out.push(`/// ${ownDocumentation}`);
      out.push('/// </summary>');
    }
  }

  if (extendsName === 'IEventEmitter')
    extendsName = null;

  if (body[0] === '')
    body = body.slice(1);

  out.push(`${kind} ${name}${extendsName ? ` : ${extendsName}` : ''}`);
  out.push('{');
  out.push(...body);
  out.push('}');

  const content = template.replace('[CONTENT]', out.join(EOL));
  fs.writeFileSync(path.join(folder, name + '.cs'), content);
}

/**
 * @param {Documentation.Class} clazz
 */
function renderClass(clazz) {
  const name = classNameMap.get(clazz.name);
  if (name === 'TimeoutException')
    return;

  const body = [];
  for (const member of clazz.membersArray) {
    // Classes inherit it from IAsyncDisposable
    if (member.name === 'dispose')
      continue;
    if (member.alias.startsWith('RunAnd'))
      renderMember(member, clazz, { trimRunAndPrefix: true }, body);
    renderMember(member, clazz, {}, body);
  }

  /** @type {Documentation.MarkdownNode[]} */
  const spec = [];
  if (clazz.deprecated)
    spec.push({ type: 'text', text: '**DEPRECATED** ' + clazz.deprecated });
  if (clazz.discouraged)
    spec.push({ type: 'text', text: clazz.discouraged });
  if (clazz.spec)
    spec.push(...clazz.spec);

  writeFile(
      'public partial interface',
      name,
      spec,
      body,
      apiDir,
      clazz.extends ? `I${toTitleCase(clazz.extends)}` : null);
}

/**
 * @param {string} name
 * @param {Documentation.Type} type
 */
function renderModelType(name, type) {
  const body = [];
  // TODO: consider how this could be merged with the `translateType` check
  if (type.union
    && type.union[0].name === 'null'
    && type.union.length === 2)
    type = type.union[1];


  if (type.name === 'Array') {
    throw new Error('Array at this stage is unexpected.');
  } else if (type.properties) {
    for (const member of type.properties) {
      const fakeType = new Type(name, null);
      renderMember(member, fakeType, {}, body);
    }
  } else {
    console.log(type);
    throw new Error(`Not sure what to do in this case.`);
  }
  writeFile('public partial class', name, null, body, typesDir);
}

/**
 * @param {string} name
 * @param {string[]} literals
 */
function renderEnum(name, literals) {
  const body = [];
  for (let literal of literals) {
    // strip out the quotes
    literal = literal.replace(/[\"]/g, ``);
    const escapedName = literal.replace(/[-]/g, ' ')
        .split(' ')
        .map(word => customTypeNames.get(word) || word[0].toUpperCase() + word.substring(1)).join('');

    body.push(`[EnumMember(Value = "${literal}")]`);
    body.push(`${escapedName},`);
  }
  writeFile('public enum', name, null, body, enumsDir);
}

/**
 * @param {string} name
 * @param {Documentation.Type} type
 */
function renderOptionType(name, type) {
  const body = [];

  renderConstructors(name, type, body);

  for (const member of type.properties)
    renderMember(member, member.type, {}, body);
  writeFile('public class', name, null, body, optionsDir);
}

for (const element of documentation.classesArray)
  renderClass(element);


for (const [name, type] of optionTypes)
  renderOptionType(name, type);

for (const [name, type] of modelTypes)
  renderModelType(name, type);

for (const [name, literals] of enumTypes)
  renderEnum(name, literals);

/**
 * @param {string} name
 */
function toArgumentName(name) {
  return name === 'event' ? `@${name}` : name;
}

/**
* @param {Documentation.Member} member
*/
function toMemberName(member, makeAsync = false) {
  const assumedName = toTitleCase(member.alias || member.name);
  if (member.kind === 'interface')
    return `I${assumedName}`;
  if (makeAsync && member.async)
    return assumedName + 'Async';
  if (!makeAsync && assumedName.endsWith('Async'))
    return assumedName.substring(0, assumedName.length - 'Async'.length);
  return assumedName;
}

/**
 * @param {string} name
 * @returns {string}
 */
function toTitleCase(name) {
  return name.charAt(0).toUpperCase() + name.substring(1);
}

/**
 *
 * @param {string} name
 * @param {Documentation.Type} type
 * @param {string[]} out
 */
function renderConstructors(name, type, out) {
  out.push(`public ${name}(){}`);
  out.push('');
  out.push(`public ${name}(${name} clone) {`);
  out.push(`if(clone == null) return;`);

  type.properties.forEach(p => {
    const propType = translateType(p.type, type, t => generateNameDefault(p, name, t, type));
    const propName = toMemberName(p);
    const overloads = getPropertyOverloads(propType, p, propName, p.type);
    for (const { name } of overloads)
      out.push(`${name} = clone.${name};`);
  });
  out.push(`}`);
}

/**
 * @param {Documentation.Member} member
 * @param {string[]} out
 */
function renderMemberDoc(member, out) {
  /** @type {Documentation.MarkdownNode[]} */
  const nodes = [];
  if (member.deprecated)
    nodes.push({ type: 'text', text: '**DEPRECATED** ' + member.deprecated });
  if (member.discouraged)
    nodes.push({ type: 'text', text: member.discouraged });
  if (member.spec)
    nodes.push(...member.spec);
  out.push(...XmlDoc.renderXmlDoc(nodes, maxDocumentationColumnWidth));
}

/**
 * @param {Documentation.Member} member
 * @param {Documentation.Class|Documentation.Type} parent
 * @param {{nojson?: boolean, trimRunAndPrefix?: boolean}} options
 * @param {string[]} out
 */
function renderMember(member, parent, options, out) {
  const name = toMemberName(member);
  if (member.kind === 'method') {
    renderMethod(member, parent, name, { trimRunAndPrefix: options.trimRunAndPrefix }, out);
    return;
  }

  let type = translateType(member.type, parent, t => generateNameDefault(member, name, t, parent));
  if (member.kind === 'event') {
    if (!member.type)
      throw new Error(`No Event Type for ${name} in ${parent.name}`);
    out.push('');
    renderMemberDoc(member, out);
    if (member.deprecated)
      out.push(`[System.Obsolete]`);
    out.push(`event EventHandler<${type}> ${name};`);
    return;
  }

  if (member.kind === 'property') {
    if (parent && member && member.name === 'children') {  // this is a special hack for Accessibility
      console.warn(`children property found in ${parent.name}, assuming array.`);
      type = `IEnumerable<${parent.name}>`;
    }
    const overloads = getPropertyOverloads(type, member, name, parent);
    for (const overload of overloads) {
      const { name, jsonName } = overload;
      let { type } = overload;
      out.push('');
      renderMemberDoc(member, out);
      if (!member.clazz)
        out.push(`${member.required ? '[Required]\n' : ''}[JsonPropertyName("${jsonName}")]`);
      if (member.deprecated)
        out.push(`[System.Obsolete]`);
      if (!type.endsWith('?') && !member.required)
        type = `${type}?`;
      const requiredSuffix = type.endsWith('?') ? '' : ' = default!;';
      if (member.clazz)
        out.push(`public ${type} ${name} { get; }`);
      else
        out.push(`public ${type} ${name} { get; set; }${requiredSuffix}`);
    }
    return;
  }
  throw new Error(`Problem rendering a member: ${type} - ${name} (${member.kind})`);
}

/**
 *
 * @param {string} type
 * @param {Documentation.Member} member
 * @param {string} name
 * @param {Documentation.Class|Documentation.Type} parent
 * @returns [{ type: string; name: string; jsonName: string; }]
 */
function getPropertyOverloads(type, member, name, parent) {
  const overloads = [];
  if (type) {
    let jsonName = member.name;
    if (member.type.expression === '[string]|[float]')
      jsonName = `${member.name}String`;
    overloads.push({ type, name, jsonName });
  }
  return overloads;
}

/**
 *
 * @param {Documentation.Member} member
 * @param {string} name
 * @param {Documentation.Type} t
 * @param {*} parent
 */
function generateNameDefault(member, name, t, parent) {
  if (!t.properties
    && !t.templates
    && !t.union
    && t.expression === '[Object]')
    return 'object';

  // we'd get this call for enums, primarily
  const enumName = generateEnumNameIfApplicable(t);
  if (!enumName && member) {
    if (member.kind === 'method' || member.kind === 'property') {
      const names = [
        parent.alias || parent.name,
        toTitleCase(member.alias || member.name),
        toTitleCase(name),
      ];
      if (names[2] === names[1])
        names.pop(); // get rid of duplicates, cheaply
      let attemptedName = names.pop();
      const typesDiffer = function(/** @type {Documentation.Type} */ left, /** @type {Documentation.Type} */ right) {
        if (left.expression && right.expression)
          return left.expression !== right.expression;
        const toExpression = (/** @type {Documentation.Member} */ t) => t.name + t.type?.expression;
        const leftOverRightProperties = new Set(left.properties?.map(toExpression) ?? []);
        for (const prop of right.properties ?? []) {
          const expression = toExpression(prop);
          if (!leftOverRightProperties.has(expression))
            return true;
          leftOverRightProperties.delete(expression);
        }
        return leftOverRightProperties.size > 0;
      };
      while (true) {
        // crude attempt at removing plurality
        if (attemptedName.endsWith('s')
          && !['properties', 'httpcredentials'].includes(attemptedName.toLowerCase()))
          attemptedName = attemptedName.substring(0, attemptedName.length - 1);

        // For some of these we don't want to generate generic types.
        // For some others we simply did not have the code that was deduping the names.
        if (attemptedName === 'BoundingBox')
          attemptedName = `${parent.name}BoundingBoxResult`;
        if (attemptedName === 'BrowserContextCookie')
          attemptedName = 'BrowserContextCookiesResult';
        if (attemptedName === 'File' || (parent.name === 'FormData' && ['SetValue', 'AppendValue'].includes(attemptedName)))
          attemptedName = `FilePayload`;
        if (attemptedName === 'Size')
          attemptedName = 'RequestSizesResult';
        if (attemptedName === 'ViewportSize' && parent.name === 'Page')
          attemptedName = 'PageViewportSizeResult';
        if (attemptedName === 'SecurityDetail')
          attemptedName = 'ResponseSecurityDetailsResult';
        if (attemptedName === 'ServerAddr')
          attemptedName = 'ResponseServerAddrResult';
        if (attemptedName === 'Timing')
          attemptedName = 'RequestTimingResult';
        if (attemptedName === 'HeadersArray')
          attemptedName = 'Header';

        const probableType = modelTypes.get(attemptedName);
        if ((probableType && typesDiffer(t, probableType))
          || (['Value'].includes(attemptedName))) {
          if (!names.length)
            throw new Error(`Ran out of possible names: ${attemptedName}`);
          attemptedName = `${names.pop()}${attemptedName}`;
          continue;
        } else {
          registerModelType(attemptedName, t);
        }
        break;
      }
      return attemptedName;
    }

    if (member.kind === 'event')
      return `${name}Payload`;

  }

  return enumName || t.name;
}

/**
 *
 * @param {Documentation.Type} type
 * @returns
 */
function generateEnumNameIfApplicable(type) {
  if (!type.union)
    return null;

  const potentialValues = type.union.filter(u => u.name.startsWith('"'));
  if ((potentialValues.length !== type.union.length)
    && !(type.union[0].name === 'null' && potentialValues.length === type.union.length - 1))
    return null; // this isn't an enum, so we don't care, we let the caller generate the name

  return type.name;
}

/**
 * Rendering a method is so _special_, with so many weird edge cases, that it
 * makes sense to put it separate from the other logic.
 * @param {Documentation.Member} member
 * @param {Documentation.Class | Documentation.Type} parent
 * @param {string} name
 * @param {{
 *   nodocs?: boolean,
 *   abstract?: boolean,
 *   public?: boolean,
 *   trimRunAndPrefix?: boolean,
 * }} options
 * @param {string[]} out
 */
function renderMethod(member, parent, name, options, out) {
  out.push('');

  if (options.trimRunAndPrefix)
    name = name.substring('RunAnd'.length);

  /** @type {Map<string, string[]>} */
  const paramDocs = new Map();
  const addParamsDoc = (paramName, docs) => {
    if (paramName.startsWith('@'))
      paramName = paramName.substring(1);
    if (paramDocs.get(paramName) && paramDocs.get(paramName) !== docs)
      throw new Error(`Parameter ${paramName} already exists in the docs.`);
    paramDocs.set(paramName, docs);
  };

  let type = translateType(member.type, parent, t => generateNameDefault(member, name, t, parent), false, true);

  // TODO: this is something that will probably go into the docs
  // translate simple getters into read-only properties, and simple
  // set-only methods to settable properties
  if (member.args.size === 0
    && type !== 'void'
    && !name.startsWith('Get')
    && name !== 'CreateFormData'
    && !name.startsWith('PostDataJSON')
    && !name.startsWith('As')) {
    if (!member.async) {
      if (member.spec && !options.nodocs)
        out.push(...XmlDoc.renderXmlDoc(member.spec, maxDocumentationColumnWidth));
      if (member.deprecated)
        out.push(`[System.Obsolete]`);
      out.push(`${type} ${name} { get; }`);
      return;
    }
  }

  // HACK: special case for generics handling!
  if (type === 'T')
    name = `${name}<T>`;


  // adjust the return type for async methods
  if (member.async) {
    if (type === 'void')
      type = `Task`;
    else
      type = `Task<${type}>`;
  }

  // render args
  /** @type {string[]} */
  const args = [];
  /** @type {string[]} */
  const explodedArgs = [];
  /** @type {Map<string, string>} */
  const argTypeMap = new Map([]);
  /**
   *
   * @param {string} innerArgType
   * @param {string} innerArgName
   * @param {Documentation.Member} argument
   * @param {boolean} isExploded
   */
  function pushArg(innerArgType, innerArgName, argument, isExploded = false) {
    if (innerArgType === 'null')
      return;
    const requiredPrefix = (argument.required || isExploded) ? '' : '?';
    const requiredSuffix = (argument.required || isExploded) ? '' : ' = default';
    const push = `${innerArgType}${requiredPrefix} ${innerArgName}${requiredSuffix}`;
    if (isExploded)
      explodedArgs.push(push);
    else
      args.push(push);
    argTypeMap.set(push, innerArgName);
  }

  /**
   * @param {Documentation.Member} arg
   */
  function processArg(arg) {
    if (options.trimRunAndPrefix && arg.name === 'action')
      return;

    if (arg.name === 'options') {
      const optionsType = rewriteSuggestedOptionsName(member.clazz.name + name.replace('<T>', '') + 'Options');
      if (!optionTypes.has(optionsType) || arg.type.properties.length > optionTypes.get(optionsType).properties.length)
        optionTypes.set(optionsType, arg.type);
      args.push(`${optionsType}? options = default`);
      argTypeMap.set(`${optionsType}? options = default`, 'options');
      addParamsDoc('options', ['Call options']);
      return;
    }

    if (arg.type.expression === '[string]|[path]') {
      const argName = toArgumentName(arg.name);
      pushArg('string?', `${argName} = default`, arg);
      pushArg('string?', `${argName}Path = default`, arg);
      if (arg.spec) {
        addParamsDoc(argName, XmlDoc.renderTextOnly(arg.spec, maxDocumentationColumnWidth));
        addParamsDoc(`${argName}Path`, [`Instead of specifying <paramref name="${argName}"/>, gives the file name to load from.`]);
      }
      return;
    } else if (arg.type.expression === '[boolean]|[Array]<[string]>') {
      // HACK: this hurts my brain too
      // we split this into two args, one boolean, with the logical name
      const argName = toArgumentName(arg.name);
      const leftArgType = translateType(arg.type.union[0], parent, t => { throw new Error('Not supported'); });
      const rightArgType = translateType(arg.type.union[1], parent, t => { throw new Error('Not supported'); });

      pushArg(leftArgType, argName, arg);
      pushArg(rightArgType, `${argName}Values`, arg);

      addParamsDoc(argName, XmlDoc.renderTextOnly(arg.spec, maxDocumentationColumnWidth));
      addParamsDoc(`${argName}Values`, [`The values to take into account when <paramref name="${argName}"/> is <code>true</code>.`]);

      return;
    }

    const argName = toArgumentName(arg.alias || arg.name);
    const argType = translateType(arg.type, parent, t => generateNameDefault(member, argName, t, parent));

    if (argType === null && arg.type.union) {
      // we might have to split this into multiple arguments
      const translatedArguments = arg.type.union.map(t => translateType(t, parent, x => generateNameDefault(member, argName, x, parent)));
      if (translatedArguments.includes(null))
        throw new Error('Unexpected null in translated argument types. Aborting.');

      const argDocumentation = XmlDoc.renderTextOnly(arg.spec, maxDocumentationColumnWidth);
      for (const newArg of translatedArguments) {
        pushArg(newArg, argName, arg, true); // push the exploded arg
        addParamsDoc(argName, argDocumentation);
      }
      args.push(arg.required ? 'EXPLODED_ARG' : 'OPTIONAL_EXPLODED_ARG');
      return;
    }

    addParamsDoc(argName, XmlDoc.renderTextOnly(arg.spec, maxDocumentationColumnWidth));

    if (argName === 'timeout' && argType === 'decimal') {
      args.push(`int timeout = 0`); // a special argument, we ignore our convention
      return;
    }

    pushArg(argType, argName, arg);
  }

  let modifiers = '';
  if (options.abstract)
    modifiers = 'protected abstract ';
  if (options.public)
    modifiers = 'public ';

  member.argsArray
      .sort((a, b) => b.alias === 'options' ? -1 : 0) // move options to the back to the arguments list
      .forEach(processArg);

  if (!explodedArgs.length) {
    if (!options.nodocs) {
      renderMemberDoc(member, out);
      paramDocs.forEach((value, i) => printArgDoc(i, value, out));
    }
    if (member.deprecated)
      out.push(`[System.Obsolete]`);
    out.push(`${modifiers}${type} ${toAsync(name, member.async)}(${args.join(', ')});`);
  } else {
    let containsOptionalExplodedArgs = false;
    explodedArgs.forEach((explodedArg, argIndex) => {
      if (!options.nodocs)
        renderMemberDoc(member, out);
      const overloadedArgs = [];
      for (let i = 0; i < args.length; i++) {
        const arg = args[i];
        if (arg === 'EXPLODED_ARG' || arg === 'OPTIONAL_EXPLODED_ARG') {
          containsOptionalExplodedArgs = arg === 'OPTIONAL_EXPLODED_ARG';
          const argType = argTypeMap.get(explodedArg);
          if (!options.nodocs)
            printArgDoc(argType, paramDocs.get(argType), out);
          overloadedArgs.push(explodedArg);
        } else {
          const argType = argTypeMap.get(arg);
          if (!options.nodocs)
            printArgDoc(argType, paramDocs.get(argType), out);
          overloadedArgs.push(arg);
        }
      }
      out.push(`${modifiers}${type} ${toAsync(name, member.async)}(${overloadedArgs.join(', ')});`);
      if (argIndex < explodedArgs.length - 1)
        out.push(''); // output a special blank line
    });

    // If the exploded union arguments are optional, we also output a special
    // signature, to help prevent compilation errors with ambiguous overloads.
    // That particular overload only contains the required arguments, or rather
    // contains all the arguments *except* the exploded ones.
    if (containsOptionalExplodedArgs) {
      const filteredArgs = args.filter(x => x !== 'OPTIONAL_EXPLODED_ARG');
      if (!options.nodocs)
        renderMemberDoc(member, out);
      filteredArgs.forEach(arg => {
        if (arg === 'EXPLODED_ARG')
          throw new Error(`Unsupported required union arg combined an optional union inside ${member.name}`);
        const argType = argTypeMap.get(arg);
        if (!options.nodocs)
          printArgDoc(argType, paramDocs.get(argType), out);
      });
      out.push(`${type} ${name}(${filteredArgs.join(', ')});`);
    }
  }
}

/**
 *
 *  @param {Documentation.Type} type
 *  @param {Documentation.Class|Documentation.Type} parent
 *  @param {function(Documentation.Type): string} generateNameCallback
 *  @param {boolean=} optional
 *  @returns {string}
 */
function translateType(type, parent, generateNameCallback = t => t.name, optional = false, isReturnType = false) {
  // a few special cases we can fix automatically
  if (type.expression === '[null]|[Error]')
    return 'void';

  if (type.name == 'Promise' && type.templates?.[0].name === 'any')
    return 'Task';

  if (type.union) {
    if (type.union[0].name === 'null' && type.union.length === 2)
      return translateType(type.union[1], parent, generateNameCallback, true, isReturnType);

    if (type.expression === '[string]|[Buffer]')
      return `byte[]`; // TODO: make sure we implement extension methods for this!
    if (type.expression === '[string]|[float]' || type.expression === '[string]|[float]|[boolean]') {
      console.warn(`${type.name} should be a 'string', but was a ${type.expression}`);
      return `string`;
    }
    if (type.union.length === 2 && type.union[1].name === 'Array' && type.union[1].templates[0].name === type.union[0].name)
      return `IEnumerable<${type.union[0].name}>`; // an example of this is [string]|[Array]<[string]>
    if (type.expression === '[float]|"raf"')
      return `Polling`; // hardcoded because there's no other way to denote this

    // Regular primitive enums are named in the markdown.
    if (type.name) {
      enumTypes.set(type.name, type.union.map(t => t.name));
      return optional ? type.name + '?' : type.name;
    }
    return null;
  }

  if (type.name === 'Array') {
    if (type.templates.length !== 1)
      throw new Error(`Array (${type.name} from ${parent.name}) has more than 1 dimension. Panic.`);

    const innerType = translateType(type.templates[0], parent, generateNameCallback, false, isReturnType);
    return isReturnType ? `IReadOnlyList<${innerType}>` : `IEnumerable<${innerType}>`;
  }

  if (type.name === 'Object') {
    // take care of some common cases
    // TODO: this can be genericized
    if (type.templates && type.templates.length === 2) {
      // get the inner types of both templates, and if they're strings, it's a keyvaluepair string, string,
      const keyType = translateType(type.templates[0], parent, generateNameCallback, false, isReturnType);
      const valueType = translateType(type.templates[1], parent, generateNameCallback, false, isReturnType);
      if (['Request', 'Response', 'APIResponse'].includes(parent.name))
        return `Dictionary<${keyType}, ${valueType}>`;
      return `IEnumerable<KeyValuePair<${keyType}, ${valueType}>>`;
    }

    if ((type.name === 'Object')
      && !type.properties
      && !type.union)
      return 'object';

    // this is an additional type that we need to generate
    const objectName = generateNameCallback(type);
    if (objectName === 'Object')
      throw new Error('Object unexpected');
    else if (type.name === 'Object')
      registerModelType(objectName, type);

    return `${objectName}${optional ? '?' : ''}`;
  }

  if (type.name === 'Map') {
    if (type.templates && type.templates.length === 2) {
      // we map to a dictionary
      const keyType = translateType(type.templates[0], parent, generateNameCallback, false, isReturnType);
      const valueType = translateType(type.templates[1], parent, generateNameCallback, false, isReturnType);
      return `Dictionary<${keyType}, ${valueType}>`;
    } else {
      throw 'Map has invalid number of templates.';
    }
  }

  if (type.name === 'function') {
    if (type.expression === '[function]' || !type.args)
      return 'Action'; // super simple mapping

    let argsList = '';
    if (type.args) {
      const translatedCallbackArguments = type.args.map(t => translateType(t, parent, generateNameCallback, false, isReturnType));
      if (translatedCallbackArguments.includes(null))
        throw new Error('There was an argument we could not parse. Aborting.');

      argsList = translatedCallbackArguments.join(', ');
    }

    if (!type.returnType) {
      // this is an Action
      return `Action<${argsList}>`;
    } else {
      const returnType = translateType(type.returnType, parent, generateNameCallback, false, isReturnType);
      if (returnType === null)
        throw new Error('Unexpected null as return type.');

      if (!argsList)
        return `Func<${returnType}>`;
      return `Func<${argsList}, ${returnType}>`;
    }
  }

  if (type.templates) {
    // this should mean we have a generic type and we can translate that
    /** @type {string[]} */
    const types = type.templates.map(template => translateType(template, parent));
    return `${type.name}<${types.join(', ')}>`;
  }

  if (type.name === 'Serializable')
    return isReturnType ? 'T' : 'object';

  // there's a chance this is a name we've already seen before, so check
  // this is also where we map known types, like boolean -> bool, etc.
  const name = classNameMap.get(type.name) || type.name;
  return `${name}${optional ? '?' : ''}`;
}

/**
 * @param {string} typeName
 * @param {Documentation.Type} type
 */
function registerModelType(typeName, type) {
  if (['object', 'string', 'int', 'long'].includes(typeName))
    return;
  if (typeName.endsWith('Option'))
    return;

  const potentialType = modelTypes.get(typeName);
  if (potentialType) {
    // console.log(`Type ${typeName} already exists, so skipping...`);
    return;
  }

  modelTypes.set(typeName, type);
}

/**
 * @param {string} name
 * @param {string[]} value
 * @param {string[]} out
 */
function printArgDoc(name, value, out) {
  if (value.length === 1) {
    out.push(`/// <param name="${name}">${value}</param>`);
  } else {
    out.push(`/// <param name="${name}">`);
    out.push(...value.map(l => `/// ${l}`));
    out.push(`/// </param>`);
  }
}

/**
 * @param {string} name
 * @param {boolean} convert
 */
function toAsync(name, convert) {
  if (!convert)
    return name;
  if (name.includes('<'))
    return name.replace('<', 'Async<');
  return name + 'Async';
}

/**
 * @param {string} suggestedName
 * @returns {string}
 */
function rewriteSuggestedOptionsName(suggestedName) {
  if ([
    'APIRequestContextDeleteOptions',
    'APIRequestContextFetchOptions',
    'APIRequestContextGetOptions',
    'APIRequestContextHeadOptions',
    'APIRequestContextPatchOptions',
    'APIRequestContextPostOptions',
    'APIRequestContextPutOptions',
  ].includes(suggestedName))
    return 'APIRequestContextOptions';
  return suggestedName;
}

