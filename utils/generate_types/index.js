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
const os = require('os');
const toKebabCase = require('lodash/kebabCase')
const devices = require('../../packages/playwright-core/lib/server/deviceDescriptors');
const Documentation = require('../doclint/documentation');
const PROJECT_DIR = path.join(__dirname, '..', '..');
const fs = require('fs');
const { parseOverrides } = require('./parseOverrides');
const exported = require('./exported.json');
const { parseApi } = require('../doclint/api_parser');

/** @typedef {import('../doclint/documentation').Member} Member */

Error.stackTraceLimit = 50;

class TypesGenerator {
  /**
   * @param {Documentation} documentation
   */
  constructor(documentation) {
    /** @type {Array<{name: string, properties: Member[]}>} */
    this.objectDefinitions = [];
    /** @type {Set<string>} */
    this.handledMethods = new Set();
    this.documentation = documentation;
  }

  /**
   * @param {string} overridesFile
   * @param {Map<string, string>=} docsOnlyClassMapping
   * @returns {Promise<string>}
   */
  async generateTypes(overridesFile, docsOnlyClassMapping) {
    this.documentation.filterForLanguage('js');
    this.documentation.copyDocsFromSuperclasses([]);

    const createMarkdownLink = (member, text) => {
      const className = toKebabCase(member.clazz.name);
      const memberName = toKebabCase(member.name);
      let hash = null
      if (member.kind === 'property' || member.kind === 'method')
        hash = `${className}-${memberName}`.toLowerCase();
      else if (member.kind === 'event')
        hash = `${className}-event-${memberName}`.toLowerCase();
      return `[${text}](https://playwright.dev/docs/api/class-${member.clazz.name.toLowerCase()}#${hash})`;
    };
    this.documentation.setLinkRenderer(item => {
      const { clazz, member, param, option } = item;
      if (param)
        return `\`${param}\``;
      if (option)
        return `\`${option}\``;
      if (clazz)
        return `[${clazz.name}]`;
      if (member.kind === 'method')
        return createMarkdownLink(member, `${member.clazz.varName}.${member.alias}(${this.renderJSSignature(member.argsArray)})`);
      if (member.kind === 'event')
        return createMarkdownLink(member, `${member.clazz.varName}.on('${member.alias.toLowerCase()}')`);
      if (member.kind === 'property')
        return createMarkdownLink(member, `${member.clazz.varName}.${member.alias}`);
      throw new Error('Unknown member kind ' + member.kind);
    });
    this.documentation.generateSourceCodeComments();

    const handledClasses = new Set();

    const overrides = await parseOverrides(overridesFile, className => {
      const docClass = this.docClassForName(className, docsOnlyClassMapping);
      if (!docClass)
        return '';
      handledClasses.add(className);
      return this.writeComment(docClass.comment) + '\n';
    }, (className, methodName, overloadIndex) => {
      const docClass = this.docClassForName(className, docsOnlyClassMapping);
      let method;
      if (docClass) {
        const methods = docClass.membersArray.filter(m => m.alias === methodName && m.kind !== 'event').sort((a, b) => a.overloadIndex - b.overloadIndex);
        // Use the last overload when not enough overloads are defined in docs.
        method = methods.find(m => m.overloadIndex === overloadIndex) || methods[methods.length - 1];
      }
      if (docsOnlyClassMapping && !method)
        return '';
      this.handledMethods.add(`${className}.${methodName}`);
      if (!method) {
        if (new Set(['on', 'addListener', 'off', 'removeListener', 'once']).has(methodName))
          return '';
        throw new Error(`Unknown override method "${className}.${methodName}"`);
      }
      return this.memberJSDOC(method, '  ').trimLeft();
    }, (className) => {
      const docClass = this.docClassForName(className, docsOnlyClassMapping);
      return (!docsOnlyClassMapping && docClass) ? this.classBody(docClass) : '';
    });

    const IGNORED_CLASSES = ['PlaywrightAssertions', 'LocatorAssertions', 'PageAssertions', 'APIResponseAssertions', 'ScreenshotAssertions'];
    const classes = this.documentation.classesArray.filter(cls => !IGNORED_CLASSES.includes(cls.name)).filter(cls => !handledClasses.has(cls.name));
    {
      const playwright = this.documentation.classesArray.find(c => c.name === 'Playwright');
      playwright.membersArray = playwright.membersArray.filter(member => !['errors', 'devices'].includes(member.name));
      playwright.index();
    }
    return [
      `// This file is generated by ${__filename.substring(path.join(__dirname, '..', '..').length).split(path.sep).join(path.posix.sep)}`,
      overrides,
      '',
      docsOnlyClassMapping ? '' : classes.map(classDesc => {
        return (classDesc.name === 'Playwright') ? this.classBody(classDesc, true) : this.classToString(classDesc);
      }).join('\n'),
      this.objectDefinitionsToString(overrides),
      '',
    ].join('\n');
  }

  /**
   * @param {string} name
   * @param {Map<string, string> | undefined} docsOnlyClassMapping
   */
  docClassForName(name, docsOnlyClassMapping) {
    name = (docsOnlyClassMapping ? docsOnlyClassMapping.get(name) : undefined) || name;
    const docClass = this.documentation.classes.get(name);
    if (!docClass && !docsOnlyClassMapping)
      throw new Error(`Unknown override class ${name}`);
    return docClass;
  }

  /**
   * @param {string} overriddes
   */
  objectDefinitionsToString(overriddes) {
    let definition;
    const parts = [];
    const internalWords = new Set(overriddes.split(/[^\w$]/g));
    while ((definition = this.objectDefinitions.pop())) {
      const { name, properties } = definition;
      const shouldExport = !!exported[name];
      const usedInternally = internalWords.has(name);
      if (!usedInternally && !shouldExport)
        continue;
      parts.push(`${shouldExport ? 'export ' : ''}interface ${name} ${this.stringifyObjectType(properties, name, '')}\n`)
    }
    return parts.join('\n');
  }

  nameForProperty(member) {
    return (member.required || member.alias.startsWith('...')) ? member.alias : member.alias + '?';
  }

  /**
   * @param {Documentation.Class} classDesc
   */
  classToString(classDesc) {
    const parts = [];
    if (classDesc.comment) {
      parts.push(this.writeComment(classDesc.comment))
    }
    parts.push(`export interface ${classDesc.name} ${classDesc.extends ? `extends ${classDesc.extends} ` : ''}{`);
    parts.push(this.classBody(classDesc));
    parts.push('}\n');
    return parts.join('\n');
  }

  /**
   * @param {string} type
   */
  argNameForType(type) {
    if (type === 'void')
      return null;
    if (type.includes('{'))
      return 'data';
    return (type[0].toLowerCase() + type.slice(1)).replace(/\|/g, 'Or');
  }

  /**
   * @param {Documentation.Class} classDesc
   */
  hasUniqueEvents(classDesc) {
    if (!classDesc.events.size)
      return false;
    const parent = this.parentClass(classDesc);
    if (!parent)
      return true;
    return Array.from(classDesc.events.keys()).some(eventName => !parent.events.has(eventName));
  }

  /**
   * @param {Documentation.Class} classDesc
   */
  createEventDescriptions(classDesc) {
    if (!this.hasUniqueEvents(classDesc))
      return [];
    const descriptions = [];
    for (let [eventName, value] of classDesc.events) {
      eventName = eventName.toLowerCase();
      const type = this.stringifyComplexType(value && value.type, '', classDesc.name, eventName, 'payload');
      const argName = this.argNameForType(type);
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
   * @param {boolean=} exportMembersAsGlobals
   */
  classBody(classDesc, exportMembersAsGlobals) {
    let parts = [];
    const eventDescriptions = this.createEventDescriptions(classDesc);
    const commentForMethod = {
      off: 'Removes an event listener added by `on` or `addListener`.',
      removeListener: 'Removes an event listener added by `on` or `addListener`.',
      once: 'Adds an event listener that will be automatically removed after it is triggered once. See `addListener` for more information about this event.'
    }
    const indent = exportMembersAsGlobals ? '' : '  ';
    for (const method of ['on', 'once', 'addListener', 'removeListener', 'off']) {
      for (const { eventName, params, comment } of eventDescriptions) {
        if ((method === 'on' || method === 'addListener') && comment)
          parts.push(this.writeComment(comment, indent));
        else
          parts.push(this.writeComment(commentForMethod[method], indent));
        parts.push(`  ${method}(event: '${eventName}', listener: (${params}) => void): this;\n`);
      }
    }

    const members = classDesc.membersArray.filter(member => member.kind !== 'event');
    parts.push(members.map(member => {
      if (member.kind === 'event')
        return '';
      if (member.alias === 'waitForEvent') {
        const parts = [];
        for (const { eventName, params, comment, type } of eventDescriptions) {
          if (comment)
            parts.push(this.writeComment(comment, indent));
          parts.push(`  ${member.alias}(event: '${eventName}', optionsOrPredicate?: { predicate?: (${params}) => boolean | Promise<boolean>, timeout?: number } | ((${params}) => boolean | Promise<boolean>)): Promise<${type}>;\n`);
        }

        return parts.join('\n');
      }
      const jsdoc = this.memberJSDOC(member, indent);
      const args = this.argsFromMember(member, indent, classDesc.name);
      let type = this.stringifyComplexType(member.type, indent, classDesc.name, member.alias);
      if (member.async)
        type = `Promise<${type}>`;
      // do this late, because we still want object definitions for overridden types
      if (!this.hasOwnMethod(classDesc, member.alias))
        return '';
      if (exportMembersAsGlobals) {
        const memberType = member.kind === 'method' ? `${args} => ${type}` : type;
        return `${jsdoc}${exportMembersAsGlobals ? 'export const ' : ''}${member.alias}: ${memberType};`
      }
      return `${jsdoc}${member.alias}${args}: ${type};`
    }).filter(x => x).join('\n\n'));
    return parts.join('\n');
  }

  /**
   * @param {Documentation.Class} classDesc
   * @param {string} methodName
   */
  hasOwnMethod(classDesc, methodName) {
    if (this.handledMethods.has(`${classDesc.name}.${methodName}`))
      return false;
    while (classDesc = this.parentClass(classDesc)) {
      if (classDesc.members.has(methodName))
        return false;
    }
    return true;
  }

  /**
   * @param {Documentation.Class} classDesc
   */
  parentClass(classDesc) {
    if (!classDesc.extends)
      return null;
    return this.documentation.classes.get(classDesc.extends);
  }

  writeComment(comment, indent = '') {
    const parts = [];
    const out = [];
    const pushLine = (line) => {
      if (line || out[out.length - 1])
        out.push(line)
    };
    let skipExample = false;
    for (let line of comment.split('\n')) {
      const match = line.match(/```(\w+)(\s+js-flavor=(\w+))?/);
      if (match) {
        const lang = match[1];
        let flavor = 'ts';
        if (match[3]) {
          flavor = match[3];
          line = line.replace(/js-flavor=\w+/, '').replace('RUNNABLE', '').replace(/```\w+/, '```ts');
        }
        skipExample = !["html", "yml", "bash", "js"].includes(lang) || flavor !== 'ts';
      } else if (skipExample && line.trim().startsWith('```')) {
        skipExample = false;
        continue;
      }
      if (!skipExample)
        pushLine(line);
    }
    comment = out.join('\n');
    comment = comment.replace(/\[([^\]]+)\]\(\.\/([^\)]+)\)/g, (match, p1, p2) => {
      return `[${p1}](https://playwright.dev/docs/${p2.replace('.md', '')})`;
    });

    parts.push(indent + '/**');
    parts.push(...comment.split('\n').map(line => indent + ' * ' + line.replace(/\*\//g, '*\\/')));
    parts.push(indent + ' */');
    return parts.join('\n');
  }

  /**
   * @param {Documentation.Type} type
   */
  stringifyComplexType(type, indent, ...namespace) {
    if (!type)
      return 'void';
    return this.stringifySimpleType(type, indent, ...namespace);
  }

  stringifyObjectType(properties, name, indent = '') {
    const parts = [];
    parts.push(`{`);
    parts.push(properties.map(member => `${this.memberJSDOC(member, indent + '  ')}${this.nameForProperty(member)}${this.argsFromMember(member, indent + '  ', name)}: ${this.stringifyComplexType(member.type, indent + '  ', name, member.name)};`).join('\n\n'));
    parts.push(indent + '}');
    return parts.join('\n');
  }

  /**
   * @param {Documentation.Type=} type
   * @returns{string}
   */
  stringifySimpleType(type, indent = '', ...namespace) {
    if (!type)
      return 'void';
    if (type.name === 'Object' && type.templates) {
      const keyType = this.stringifySimpleType(type.templates[0], indent, ...namespace);
      const valueType = this.stringifySimpleType(type.templates[1], indent, ...namespace);
      return `{ [key: ${keyType}]: ${valueType}; }`;
    }
    let out = type.name;
    if (out === 'int' || out === 'float')
      out = 'number';

    if (type.name === 'Object' && type.properties && type.properties.length) {
      const name = namespace.map(n => n[0].toUpperCase() + n.substring(1)).join('');
      const shouldExport = exported[name];
      const properties = namespace[namespace.length - 1] === 'options' ? type.sortedProperties() : type.properties;
      this.objectDefinitions.push({ name, properties });
      if (shouldExport) {
        out = name;
      } else {
        out = this.stringifyObjectType(properties, name, indent);
      }
    }

    if (type.args) {
      const stringArgs = type.args.map(a => ({
        type: this.stringifySimpleType(a, indent, ...namespace),
        name: a.name.toLowerCase()
      }));
      out = `((${stringArgs.map(({ name, type }) => `${name}: ${type}`).join(', ')}) => ${this.stringifySimpleType(type.returnType, indent, ...namespace)})`;
    } else if (type.name === 'function') {
      out = 'Function';
    }
    if (out === 'path')
      return 'string';
    if (out === 'Any')
      return 'any';
    if (type.templates)
      out += '<' + type.templates.map(t => this.stringifySimpleType(t, indent, ...namespace)).join(', ') + '>';
    if (type.union)
      out = type.union.map(t => this.stringifySimpleType(t, indent, ...namespace)).join('|');
    return out.trim();
  }

  /**
   * @param {Documentation.Member} member
   */
  argsFromMember(member, indent, ...namespace) {
    if (member.kind === 'property')
      return '';
    return '(' + member.argsArray.map(arg => `${this.nameForProperty(arg)}: ${this.stringifyComplexType(arg.type, indent, ...namespace, member.alias, arg.alias)}`).join(', ') + ')';
  }

  /**
   * @param {Documentation.Member} member
   * @param {string} indent
   */
  memberJSDOC(member, indent) {
    const lines = [];
    if (member.comment)
      lines.push(...member.comment.split('\n'));
    if (member.deprecated)
      lines.push('@deprecated');
    lines.push(...member.argsArray.map(arg => `@param ${arg.alias.replace(/\./g, '')} ${arg.comment.replace('\n', ' ')}`));
    if (!lines.length)
      return indent;
    return this.writeComment(lines.join('\n'), indent) + '\n' + indent;
  }

  /**
   * @param {Documentation.Member[]} args
   */
  renderJSSignature(args) {
    const tokens = [];
    let hasOptional = false;
    for (const arg of args) {
      const name = arg.alias;
      const optional = !arg.required;
      if (tokens.length) {
        if (optional && !hasOptional)
          tokens.push(`[, ${name}`);
        else
          tokens.push(`, ${name}`);
      } else {
        if (optional && !hasOptional)
          tokens.push(`[${name}`);
        else
          tokens.push(`${name}`);
      }
      hasOptional = hasOptional || optional;
    }
    if (hasOptional)
      tokens.push(']');
    return tokens.join('');
  }
}

(async function () {
  let hadChanges = false;

  /**
   * @param {string} filePath
   * @param {string} content
   */
  function writeFile(filePath, content) {
    if (os.platform() === 'win32')
      content = content.replace(/\r\n/g, '\n').replace(/\n/g, '\r\n');
    const existing = fs.readFileSync(filePath, 'utf8');
    if (existing === content)
      return;
    hadChanges = true;
    console.error(`Writing //${path.relative(PROJECT_DIR, filePath)}`);
    fs.writeFileSync(filePath, content, 'utf8');
  }

  const coreTypesDir = path.join(PROJECT_DIR, 'packages', 'playwright-core', 'types');
  if (!fs.existsSync(coreTypesDir))
    fs.mkdirSync(coreTypesDir)
  const testTypesDir = path.join(PROJECT_DIR, 'packages', 'playwright-test', 'types');
  if (!fs.existsSync(testTypesDir))
    fs.mkdirSync(testTypesDir)
  writeFile(path.join(coreTypesDir, 'protocol.d.ts'), fs.readFileSync(path.join(PROJECT_DIR, 'packages', 'playwright-core', 'src', 'server', 'chromium', 'protocol.d.ts'), 'utf8'));

  const apiDocumentation = parseApi(path.join(PROJECT_DIR, 'docs', 'src', 'api'));
  apiDocumentation.index();
  const apiTypesGenerator = new TypesGenerator(apiDocumentation);
  let apiTypes = await apiTypesGenerator.generateTypes(path.join(__dirname, 'overrides.d.ts'));
  const namedDevices = Object.keys(devices).map(name => `  ${JSON.stringify(name)}: DeviceDescriptor;`).join('\n');
  apiTypes += [
    `type Devices = {`,
    namedDevices,
    `  [key: string]: DeviceDescriptor;`,
    `}`,
    ``,
    `export interface ChromiumBrowserContext extends BrowserContext { }`,
    `export interface ChromiumBrowser extends Browser { }`,
    `export interface FirefoxBrowser extends Browser { }`,
    `export interface WebKitBrowser extends Browser { }`,
    `export interface ChromiumCoverage extends Coverage { }`,
    ``,
  ].join('\n');
  for (const [key, value] of Object.entries(exported))
    apiTypes = apiTypes.replace(new RegExp('\\b' + key + '\\b', 'g'), value);
  apiTypes = apiTypes.replace(/( +)\n/g, '\n'); // remove trailing whitespace
  writeFile(path.join(coreTypesDir, 'types.d.ts'), apiTypes);

  const testOnlyDocumentation = parseApi(path.join(PROJECT_DIR, 'docs', 'src', 'test-api'), path.join(PROJECT_DIR, 'docs', 'src', 'api', 'params.md'));
  const testDocumentation = apiDocumentation.mergeWith(testOnlyDocumentation);
  const testTypesGenerator = new TypesGenerator(testDocumentation);
  const testClassMapping = new Map([
    ['TestType', 'Test'],
    ['Config', 'TestConfig'],
    ['FullConfig', 'TestConfig'],
    ['Project', 'TestProject'],
    ['PlaywrightWorkerOptions', 'TestOptions'],
    ['PlaywrightTestOptions', 'TestOptions'],
    ['PlaywrightWorkerArgs', 'Fixtures'],
    ['PlaywrightTestArgs', 'Fixtures'],
  ]);
  let testTypes = await testTypesGenerator.generateTypes(path.join(__dirname, 'overrides-test.d.ts'), testClassMapping);
  testTypes = testTypes.replace(/( +)\n/g, '\n'); // remove trailing whitespace
  writeFile(path.join(testTypesDir, 'test.d.ts'), testTypes);

  const testReporterOnlyDocumentation = parseApi(path.join(PROJECT_DIR, 'docs', 'src', 'test-reporter-api'));
  const testReporterDocumentation = testDocumentation.mergeWith(testReporterOnlyDocumentation);
  const testReporterTypesGenerator = new TypesGenerator(testReporterDocumentation);
  let testReporterTypes = await testReporterTypesGenerator.generateTypes(path.join(__dirname, 'overrides-testReporter.d.ts'), new Map());
  testReporterTypes = testReporterTypes.replace(/( +)\n/g, '\n'); // remove trailing whitespace
  writeFile(path.join(testTypesDir, 'testReporter.d.ts'), testReporterTypes);

  process.exit(hadChanges && process.argv.includes('--check-clean') ? 1 : 0);
})().catch(e => {
  console.error(e);
  process.exit(1);
});
