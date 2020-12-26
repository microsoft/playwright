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

//@ts-check
const path = require('path');
const Source = require('../doclint/Source');
const {chromium, devices} = require('../..');
const Documentation = require('../doclint/check_public_api/Documentation');
const PROJECT_DIR = path.join(__dirname, '..', '..');
const fs = require('fs');
const {parseOverrides} = require('./parseOverrides');
const exported = require('./exported.json');
const objectDefinitions = [];
const handledMethods = new Set();
/** @type {Documentation} */
let documentation;
let hadChanges = false;

(async function() {
  const typesDir = path.join(PROJECT_DIR, 'types');
  if (!fs.existsSync(typesDir))
    fs.mkdirSync(typesDir)
  writeFile(path.join(typesDir, 'protocol.d.ts'), fs.readFileSync(path.join(PROJECT_DIR, 'src', 'server', 'chromium', 'protocol.ts'), 'utf8'));
  writeFile(path.join(typesDir, 'trace.d.ts'), fs.readFileSync(path.join(PROJECT_DIR, 'src', 'trace', 'traceTypes.ts'), 'utf8'));
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const api = await Source.readFile(path.join(PROJECT_DIR, 'docs', 'api.md'));
  const {documentation: mdDocumentation} = await require('../doclint/check_public_api/MDBuilder')(page, [api], true);
  await browser.close();
  const sources = await Source.readdir(path.join(PROJECT_DIR, 'src', 'client'), '', []);
  const {documentation: jsDocumentation} = await require('../doclint/check_public_api/JSBuilder').checkSources(sources);
  documentation = mergeDocumentation(mdDocumentation, jsDocumentation);
  const handledClasses = new Set();

  function docClassForName(name) {
    const docClass = documentation.classes.get(name);
    if (!docClass)
      throw new Error(`Unknown override class "${name}"`);
    return docClass;
  }
  const overrides = await parseOverrides(className => {
    handledClasses.add(className);
    return writeComment(docClassForName(className).comment) + '\n';
  }, (className, methodName) => {
    const docClass = docClassForName(className);
    const method = docClass.methods.get(methodName);
    handledMethods.add(`${className}.${methodName}`);
    if (!method) {
      if (new Set(['on', 'addListener', 'off', 'removeListener', 'once']).has(methodName))
        return '';
      throw new Error(`Unknown override method "${className}.${methodName}"`);
    }
    return memberJSDOC(method, '  ').trimLeft();
  }, (className) => {
    return classBody(docClassForName(className));
  });
  const classes = documentation.classesArray.filter(cls => !handledClasses.has(cls.name));
  let output = `// This file is generated by ${__filename.substring(path.join(__dirname, '..', '..').length)}
${overrides}

${classes.map(classDesc => classToString(classDesc)).join('\n')}
${objectDefinitionsToString(overrides)}
${generateDevicesTypes()}
`;
  for (const [key, value] of Object.entries(exported))
    output = output.replace(new RegExp('\\b' + key + '\\b', 'g'), value);
  writeFile(path.join(typesDir, 'types.d.ts'), output);
  process.exit(hadChanges && process.argv.includes('--check-clean') ? 1 : 0);
})().catch(e => {
  console.error(e);
  process.exit(1);
});

function writeFile(filePath, content) {
  const existing = fs.readFileSync(filePath, 'utf8');
  if (existing === content)
    return;
  hadChanges = true;
  console.error(`Writing //${path.relative(PROJECT_DIR, filePath)}`);
  fs.writeFileSync(filePath, content, 'utf8');
}

/**
 * @param {string} overriddes
 */
function objectDefinitionsToString(overriddes) {
  let definition;
  const parts = [];
  const internalWords = new Set(overriddes.split(/[^\w$]/g));
  while ((definition = objectDefinitions.pop())) {
    const {name, properties} = definition;
    const shouldExport = !!exported[name];
    const usedInternally = internalWords.has(name);
    if (!usedInternally && !shouldExport)
      continue;
    parts.push(`${shouldExport ? 'export ' : ''}interface ${name} ${stringifyObjectType(properties, name, '')}\n`)
  }
  return parts.join('\n');
}

function nameForProperty(member) {
  return (member.required || member.name.startsWith('...')) ? member.name : member.name + '?';
}

/**
 * @param {Documentation.Class} classDesc
 */
function classToString(classDesc) {
  const parts = [];
  if (classDesc.comment) {
    parts.push(writeComment(classDesc.comment))
  }
  if (classDesc.templates.length)
    console.error(`expected an override for "${classDesc.name}" becasue it is templated`);
  parts.push(`export interface ${classDesc.name} ${classDesc.extends ? `extends ${classDesc.extends} ` : ''}{`);
  parts.push(classBody(classDesc));
  parts.push('}\n');
  return parts.join('\n');
}

/**
 * @param {string} type
 */
function argNameForType(type) {
  if (type === 'void')
    return null;
  if (type.includes('{'))
    return 'data';
  return (type[0].toLowerCase() + type.slice(1)).replace(/\|/g, 'Or');
}

/**
 * @param {Documentation.Class} classDesc
 */
function hasUniqueEvents(classDesc) {
  if (!classDesc.events.size)
    return false;
  const parent = parentClass(classDesc);
  if (!parent)
    return true;
  return Array.from(classDesc.events.keys()).some(eventName => !parent.events.has(eventName));
}

/**
 * @param {Documentation.Class} classDesc
 */
function createEventDescriptions(classDesc) {
  if (!hasUniqueEvents(classDesc))
    return [];
  const descriptions = [];
  for (const [eventName, value] of classDesc.events) {
    const type = stringifyComplexType(value && value.type, '', classDesc.name, eventName, 'payload');
    const argName = argNameForType(type);
    const params = argName ? `${argName}: ${type}` : '';
    descriptions.push({
      type,
      params,
      eventName,
      comment: value.comment
    });
  }
  return descriptions;
}

/**
 * @param {Documentation.Class} classDesc
 */
function classBody(classDesc) {
  const parts = [];
  const eventDescriptions = createEventDescriptions(classDesc);
  for (const method of ['on', 'once', 'addListener', 'removeListener', 'off']) {
    for (const {eventName, params, comment} of eventDescriptions) {
        if (comment)
          parts.push(writeComment(comment, '  '));
        parts.push(`  ${method}(event: '${eventName}', listener: (${params}) => void): this;\n`);
    }
  }

  const members = classDesc.membersArray.filter(member => member.kind !== 'event');
  parts.push(members.map(member => {
    if (member.kind === 'event')
      return '';
    if (member.name === 'waitForEvent') {
      const parts = [];
      for (const {eventName, params, comment, type} of eventDescriptions) {
        if (comment)
          parts.push(writeComment(comment, '  '));
        parts.push(`  ${member.name}(event: '${eventName}', optionsOrPredicate?: { predicate?: (${params}) => boolean, timeout?: number } | ((${params}) => boolean)): Promise<${type}>;\n`);
      }

      return parts.join('\n');
    }
    const jsdoc = memberJSDOC(member, '  ');
    const args = argsFromMember(member, '  ', classDesc.name);
    const type = stringifyComplexType(member.type, '  ', classDesc.name, member.name);
    // do this late, because we still want object definitions for overridden types
    if (!hasOwnMethod(classDesc, member.name))
      return '';
    if (member.templates.length)
      console.error(`expected an override for "${classDesc.name}.${member.name}" because it is templated`);
    return `${jsdoc}${member.name}${args}: ${type};`
  }).filter(x => x).join('\n\n'));
  return parts.join('\n');
}

/**
 * @param {Documentation.Class} classDesc
 * @param {string} methodName
 */
function hasOwnMethod(classDesc, methodName) {
  if (handledMethods.has(`${classDesc.name}.${methodName}`))
    return false;
  while (classDesc = parentClass(classDesc)) {
    if (classDesc.members.has(methodName))
      return false;
  }
  return true;
}

/**
 * @param {Documentation.Class} classDesc
 */
function parentClass(classDesc) {
  if (!classDesc.extends)
    return null;
  return documentation.classes.get(classDesc.extends);
}

function writeComment(comment, indent = '') {
  const parts = [];
  parts.push(indent + '/**');
  parts.push(...comment.split('\n').map(line => indent + ' * ' + line.replace(/\*\//g, '*\\/')));
  parts.push(indent + ' */');
  return parts.join('\n');
}

/**
 * @param {Documentation.Type} type
 */
function stringifyComplexType(type, indent, ...namespace) {
  if (!type)
    return 'void';
  let typeString = stringifySimpleType(parseType(type.name));
  if (type.properties.length && typeString.indexOf('Object') !== -1) {
    const name = namespace.map(n => n[0].toUpperCase() + n.substring(1)).join('');
    const shouldExport = exported[name];
    objectDefinitions.push({name, properties: type.properties});
    if (shouldExport) {
      typeString = typeString.replace(/Object/g, name);
    } else {
      const objType = stringifyObjectType(type.properties, name, indent);
      typeString = typeString.replace(/Object/g, objType);
    }
  }
  return typeString;
}

function stringifyObjectType(properties, name, indent = '') {
  const parts = [];
  parts.push(`{`);
  parts.push(properties.map(member => `${memberJSDOC(member, indent + '  ')}${nameForProperty(member)}${argsFromMember(member, indent + '  ', name)}: ${stringifyComplexType(member.type, indent + '  ',  name, member.name)};`).join('\n\n'));
  parts.push(indent + '}');
  return parts.join('\n');
}

/**
 * @param {string} type
 */
function parseType(type) {
  type = type.trim();
  if (type.startsWith('?')) {
    const parsed = parseType(type.substring(1));
    parsed.nullable = true;
    return parsed;
  }
  if (type.startsWith('...'))
    return parseType('Array<' + type.substring(3) + '>');
  let name = type;
  let next = null;
  let template = null;
  let args = null;
  let retType = null;
  let firstTypeLength = type.length;
  for (let i = 0; i < type.length; i++) {
    if (type[i] === '<') {
      name = type.substring(0, i);
      const matching = matchingBracket(type.substring(i), '<', '>');
      template = parseType(type.substring(i + 1, i + matching - 1));
      firstTypeLength = i + matching;
      break;
    }
    if (type[i] === '(') {
      name = type.substring(0, i);
      const matching = matchingBracket(type.substring(i), '(', ')');
      args = parseType(type.substring(i + 1, i + matching - 1));
      i = i + matching;
      if (type[i] === ':') {
        retType = parseType(type.substring(i + 1));
        next = retType.next;
        retType.next = null;
        break;
      }
    }
    if (type[i] === '|' || type[i] === ',') {
      name = type.substring(0, i);
      firstTypeLength = i;
      break;
    }
  }
  let pipe = null;
  if (type[firstTypeLength] === '|')
    pipe = parseType(type.substring(firstTypeLength + 1));
  else if (type[firstTypeLength] === ',')
    next = parseType(type.substring(firstTypeLength + 1));
  if (name === 'Promise' && !template)
    template = parseType('void');
  return {
    name,
    args,
    retType,
    template,
    pipe,
    next
  };
}

/**
 * @return {string}
 */
function stringifySimpleType(parsedType) {
  if (!parsedType)
    return 'void';
  if (parsedType.name === 'Object' && parsedType.template) {
    const keyType = stringifySimpleType({
      ...parsedType.template,
      next: null
    });
    const valueType = stringifySimpleType(parsedType.template.next);
    return `{ [key: ${keyType}]: ${valueType}; }`;
  }
  let out = parsedType.name;
  if (parsedType.args) {
    let args = parsedType.args;
    const stringArgs = [];
    while (args) {
      const arg = args;
      args = args.next;
      arg.next = null;
      stringArgs.push({
        type: stringifySimpleType(arg),
        name: arg.name.toLowerCase()
      });
    }
    out = `((${stringArgs.map(({name, type}) => `${name}: ${type}`).join(', ')}) => ${stringifySimpleType(parsedType.retType)})`;
  } else if (parsedType.name === 'function') {
    out = 'Function';
  }
  if (parsedType.nullable)
    out = 'null|' + out;
  if (parsedType.template)
    out += '<' + stringifySimpleType(parsedType.template) + '>';
  if (parsedType.pipe)
    out += '|' + stringifySimpleType(parsedType.pipe);
  if (parsedType.next)
    out += ', ' + stringifySimpleType(parsedType.next);
  return out.trim();
}

function matchingBracket(str, open, close) {
  let count = 1;
  let i = 1;
  for (; i < str.length && count; i++) {
    if (str[i] === open)
      count++;
    else if (str[i] === close)
      count--;
  }
  return i;
}

/**
 * @param {Documentation.Member} member
 */
function argsFromMember(member, indent, ...namespace) {
  if (member.kind === 'property')
    return '';
  return '(' + member.argsArray.map(arg => `${nameForProperty(arg)}: ${stringifyComplexType(arg.type, indent, ...namespace, member.name, arg.name)}`).join(', ') + ')';
}
/**
 * @param {Documentation.Member} member
 * @param {string} indent
 */
function memberJSDOC(member, indent) {
  const lines = [];
  if (member.comment)
    lines.push(...member.comment.split('\n'));
  lines.push(...member.argsArray.map(arg => `@param ${arg.name.replace(/\./g, '')} ${arg.comment.replace('\n', ' ')}`));
  if (member.returnComment)
    lines.push(`@returns ${member.returnComment}`);
  if (!lines.length)
    return indent;
  return writeComment(lines.join('\n'), indent) + '\n' + indent;
}

/**
 * @param {Documentation} mdDoc
 * @param {Documentation} jsDoc
 * @return {Documentation}
 */
function mergeDocumentation(mdDoc, jsDoc) {
  const classes = [];
  for (const mdClass of mdDoc.classesArray) {
    const jsClass = jsDoc.classes.get(mdClass.name);
    if (!jsClass)
      classes.push(mdClass);
    else
      classes.push(mergeClasses(mdClass, jsClass));
  }

  return mdDoc;
}

/**
 * @param {Documentation.Class} mdClass
 * @param {Documentation.Class} jsClass
 * @return {Documentation.Class}
 */
function mergeClasses(mdClass, jsClass) {
  mdClass.templates = jsClass.templates;
  for (const member of mdClass.membersArray)
    member.templates = jsClass.members.get(member.name).templates;
  return mdClass;
}

function generateDevicesTypes() {
  const namedDevices =
    Object.keys(devices)
      .map(name => `  ${JSON.stringify(name)}: DeviceDescriptor;`)
      .join('\n');
  return `type Devices = {
${namedDevices}
  [key: string]: DeviceDescriptor;
}`;
}
