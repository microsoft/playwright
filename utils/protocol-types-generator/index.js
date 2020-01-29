// @ts-check
const path = require('path');
const fs = require('fs');
const StreamZip = require('node-stream-zip');
const vm = require('vm');
const os = require('os');

async function generateChromiunProtocol(revision) {
  const outputPath = path.join(__dirname, '..', '..', 'src', 'chromium', 'protocol.ts');
  if (revision.local && fs.existsSync(outputPath))
    return;
  const playwright = await require('../../index').chromium;
  const browserApp = await playwright.launchBrowserApp({executablePath: revision.executablePath, webSocket: true});
  const origin = browserApp.wsEndpoint().match(/ws:\/\/([0-9A-Za-z:\.]*)\//)[1];
  const browser = await playwright.connect(browserApp.connectOptions());
  const page = await browser.defaultContext().newPage();
  await page.goto(`http://${origin}/json/protocol`);
  const json = JSON.parse(await page.evaluate(() => document.documentElement.innerText));
  await browserApp.close();
  fs.writeFileSync(outputPath, jsonToTS(json));
  console.log(`Wrote protocol.ts to ${path.relative(process.cwd(), outputPath)}`);
}

async function generateWebKitProtocol(revision) {
  const outputPath = path.join(__dirname, '..', '..', 'src', 'webkit', 'protocol.ts');
  if (revision.local && fs.existsSync(outputPath))
    return;
  const json = JSON.parse(fs.readFileSync(path.join(revision.folderPath, 'protocol.json'), 'utf8'));
  fs.writeFileSync(outputPath, jsonToTS({domains: json}));
  console.log(`Wrote protocol.ts for WebKit to ${path.relative(process.cwd(), outputPath)}`);
}

function jsonToTS(json) {
  return `// This is generated from /utils/protocol-types-generator/index.js
type binary = string;
export module Protocol {${json.domains.map(domain => `${domain.description ? `
  /**
   * ${domain.description}
   */` : ''}
  export module ${domain.domain} {${(domain.types || []).map(type => `${type.description ? `
    /**
     * ${type.description}
     */` : ''}${type.properties ? `
    export interface ${type.id} {${(type.properties || []).map(property => `${property.description ? `
      /**
       * ${property.description}
       */` : ''}
      ${property.name}${property.optional ? '?' : ''}: ${typeOfProperty(property)};`).join(``)}
    }` : `
    export type ${type.id} = ${typeOfProperty(type)};`}`).join('')}
    ${(domain.events || []).map(event => `${event.description ? `
    /**
     * ${event.description}
     */` : ''}${event.parameters ? `
    export type ${event.name}Payload = {${event.parameters.map(parameter => `${parameter.description ? `
      /**
       * ${parameter.description}
       */` : ''}
      ${parameter.name}${parameter.optional ? '?' : ''}: ${typeOfProperty(parameter)};`).join(``)}
    }` : `
    export type ${event.name}Payload = void;`}`).join('')}
    ${(domain.commands || []).map(command => `${command.description ? `
    /**
     * ${command.description}
     */` : ''}
    export type ${command.name}Parameters = {${(command.parameters || []).map(parameter => `${parameter.description ? `
      /**
       * ${parameter.description}
       */` : ''}
      ${parameter.name}${parameter.optional ? '?' : ''}: ${typeOfProperty(parameter)};`).join(``)}
    }
    export type ${command.name}ReturnValue = {${(command.returns || []).map(retVal => `${retVal.description ? `
      /**
       * ${retVal.description}
       */` : ''}
      ${retVal.name}${retVal.optional ? '?' : ''}: ${typeOfProperty(retVal)};`).join(``)}
    }`).join('')}
  }
  `).join('')}
  export interface Events {${json.domains.map(domain => (domain.events || []).map(event => `
    "${domain.domain}.${event.name}": ${domain.domain}.${event.name}Payload;`).join('')).join('')}
  }
  export interface CommandParameters {${json.domains.map(domain => (domain.commands || []).map(command => `
    "${domain.domain}.${command.name}": ${domain.domain}.${command.name}Parameters;`).join('')).join('')}
  }
  export interface CommandReturnValues {${json.domains.map(domain => (domain.commands || []).map(command => `
    "${domain.domain}.${command.name}": ${domain.domain}.${command.name}ReturnValue;`).join('')).join('')}
  }
}
`;
}


/**
 * @typedef {Object} Property
 * @property {string=} $ref
 * @property {!Array=} enum
 * @property {string=} type
 * @property {!Property=} items
 * @property {string=} description
 */

/**
 * @param {!Property} property
 * @param {string=} domain
 */
function typeOfProperty(property, domain) {
  if (property.$ref) return property.$ref.includes('.') || !domain ? property.$ref : domain + '.' + property.$ref;
  if (property.enum) return property.enum.map(value => JSON.stringify(value)).join('|');
  switch (property.type) {
    case 'array':
      return typeOfProperty(property.items, domain) + '[]';
    case 'integer':
      return 'number';
    case 'object':
      return '{ [key: string]: string }';
  }
  return property.type;
}

async function generateFirefoxProtocol(revision) {
  const outputPath = path.join(__dirname, '..', '..', 'src', 'firefox', 'protocol.ts');
  if (revision.local && fs.existsSync(outputPath))
    return;
  const omnija = os.platform() === 'darwin' ?
    path.join(revision.executablePath, '..', '..', 'Resources', 'omni.ja') :
    path.join(revision.executablePath, '..', 'omni.ja');
  const zip = new StreamZip({file: omnija, storeEntries: true});
  // @ts-ignore
  await new Promise(x => zip.on('ready', x));
  const data = zip.entryDataSync(zip.entry('chrome/juggler/content/protocol/Protocol.js'))

  const ctx = vm.createContext();
  const protocolJSCode = data.toString('utf8');
  function inject() {
    this.ChromeUtils = {
      import: () => ({t})
    }
    const t = {};
    t.String = {"$type": "string"};
    t.Number = {"$type": "number"};
    t.Boolean = {"$type": "boolean"};
    t.Undefined = {"$type": "undefined"};
    t.Any = {"$type": "any"};

    t.Enum = function(values) {
      return {"$type": "enum", "$values": values};
    }

    t.Nullable = function(scheme) {
      return {...scheme, "$nullable": true};
    }

    t.Optional = function(scheme) {
      return {...scheme, "$optional": true};
    }

    t.Array = function(scheme) {
      return {"$type": "array", "$items": scheme};
    }

    t.Recursive = function(types, schemeName) {
      return {"$type": "ref", "$ref": schemeName };
    }
  }
  const json = vm.runInContext(`(${inject})();${protocolJSCode}; this.protocol;`, ctx);
  fs.writeFileSync(outputPath, firefoxJSONToTS(json));
  console.log(`Wrote protocol.ts for Firefox to ${path.relative(process.cwd(), outputPath)}`);
}

function firefoxJSONToTS(json) {
  const domains = Object.entries(json.domains);
  return `// This is generated from /utils/protocol-types-generator/index.js
export module Protocol {
${domains.map(([domainName, domain]) => `
  export module ${domainName} {${Object.entries(domain.types).map(([typeName, type]) => `
    export type ${typeName} = ${firefoxTypeToString(type, '    ')};`).join('')}${(Object.entries(domain.events)).map(([eventName, event]) => `
    export type ${eventName}Payload = ${firefoxTypeToString(event)}`).join('')}${(Object.entries(domain.methods)).map(([commandName, command]) => `
    export type ${commandName}Parameters = ${firefoxTypeToString(command.params)};
    export type ${commandName}ReturnValue = ${firefoxTypeToString(command.returns)};`).join('')}
  }`).join('')}
  export interface Events {${domains.map(([domainName, domain]) => Object.keys(domain.events).map(eventName => `
    "${domainName}.${eventName}": ${domainName}.${eventName}Payload;`).join('')).join('')}
  }
  export interface CommandParameters {${domains.map(([domainName, domain]) => Object.keys(domain.methods).map(commandName => `
    "${domainName}.${commandName}": ${domainName}.${commandName}Parameters;`).join('')).join('')}
  }
  export interface CommandReturnValues {${domains.map(([domainName, domain]) => Object.keys(domain.methods).map(commandName => `
    "${domainName}.${commandName}": ${domainName}.${commandName}ReturnValue;`).join('')).join('')}
  }
}`

}

function firefoxTypeToString(type, indent='    ') {
  if (!type)
    return 'void';
  if (!type['$type']) {
    const properties = Object.entries(type).filter(([name]) => !name.startsWith('$'));
    const lines = [];
    lines.push('{');
    for (const [propertyName, property] of properties) {
      const nameSuffix = property['$optional'] ? '?' : '';
      const valueSuffix = property['$nullable'] ? '|null' : ''
      lines.push(`${indent}  ${propertyName}${nameSuffix}: ${firefoxTypeToString(property, indent + '  ')}${valueSuffix};`);
    }
    lines.push(`${indent}}`);
    return lines.join('\n');
  }
  if (type['$type'] === 'ref')
    return type['$ref'];
  if (type['$type'] === 'array')
    return firefoxTypeToString(type['$items'], indent) + '[]';
  if (type['$type'] === 'enum')
    return '(' + type['$values'].map(v => JSON.stringify(v)).join('|') + ')';
  return type['$type'];
}

function generateInternalProtocol() {
  const pdlPath = path.join(__dirname, '..', '..', 'src', 'protocol', 'protocol.pdl');
  const tsPath = path.join(__dirname, '..', '..', 'src', 'protocol', 'protocol.ts');
  const json = pdlToJSON(fs.readFileSync(pdlPath, 'utf-8'));
  fs.writeFileSync(tsPath, jsonToTS(json));
  console.log(`Wrote protocol.ts to ${path.relative(process.cwd(), tsPath)}`);
}

function pdlToJSON(pdl) {
  const lines = pdl.split('\n');
  let lineIndex = 0;
  let current;

  function next() {
    while (lineIndex < lines.length) {
      let line = lines[lineIndex++];
      let indent = 0;
      while (line[indent] === ' ')
        indent++;
      let commentIndex = line.indexOf('#');
      if (commentIndex !== -1)
        line = line.substring(0, commentIndex);
      line = line.trim();
      if (line) {
        current = { line, indent };
        return current;
      }
    }
    current = { indent: -1, line: '' };
    return current;
  }

  function readDomains() {
    const domains = [];
    while (current.indent !== -1)
      domains.push(readDomain());
    return domains;
  }

  function readDomain() {
    const indent = current.indent;
    const match = current.line.match(/^domain\s+([a-zA-Z0-9_]+)$/);
    next();
    const domain = {
      domain: match[1],
      commands: [],
      events: [],
      types: [],
    };
    while (current.indent > indent) {
      if (current.line.startsWith('command'))
        domain.commands.push(readCommand());
      else if (current.line.startsWith('event'))
        domain.events.push(readEvent());
      else if (current.line.startsWith('type'))
        domain.types.push(readType());
      else
        throw new Error(`Cannot parse: ${current.line}`);
    }
    return domain;
  }

  function readCommand() {
    const indent = current.indent;
    const match = current.line.match(/^command\s+([a-zA-Z0-9_]+)$/);
    next();
    const command = {
      name: match[1],
      parameters: [],
      returns: [],
    };
    while (current.indent > indent) {
      if (current.line === 'parameters') {
        const i = current.indent;
        next();
        while (current.indent > i)
          command.parameters.push(readProperty());
      } else if (current.line === 'returns') {
        const i = current.indent;
        next();
        while (current.indent > i)
          command.returns.push(readProperty());
      } else {
        throw new Error(`Cannot parse: ${current.line}`);
      }
    }
    return command;
  }

  function readEvent() {
    const indent = current.indent;
    const match = current.line.match(/^event\s+([a-zA-Z0-9_]+)$/);
    next();
    const event = {
      name: match[1],
      parameters: [],
      returns: [],
    };
    while (current.indent > indent) {
      if (current.line === 'parameters') {
        const i = current.indent;
        next();
        while (current.indent > i)
          event.parameters.push(readProperty());
      } else {
        throw new Error(`Cannot parse: ${current.line}`);
      }
    }
    return event;
  }

  function readType() {
    const match = current.line.match(/^type\s+([a-zA-Z0-9_]+)\s+extends(.*)$/);
    const type = {
      id: match[1],
    };
    let t = type;
    const words = match[2].split(' ').filter(s => !!s);
    while (words[0] === 'array' && words[1] === 'of') {
      t.type = 'array';
      const items = {};
      t.items = items;
      t = items;
      words.shift();
      words.shift();
    }
    if (words.length !== 1)
      throw new Error(`Cannot parse: ${current.line}`);
    if (['boolean', 'integer', 'number'].includes(words[0])) {
      t.type = words[0];
      next();
    } else if (words[0] === 'object') {
      t.type = 'object';
      next();
      if (current.line !== 'properties')
        throw new Error(`Cannot parse: ${current.line}`);
      const indent = current.indent;
      next();
      t.properties = [];
      while (current.indent > indent)
        t.properties.push(readProperty());
    } else if (words[0] === 'string') {
      t.type = 'string';
      next();
      if (current.line === 'enum') {
        const indent = current.indent;
        next();
        t.enum = [];
        while (current.indent > indent) {
          if (!current.line.match(/^[a-zA-Z0-9_]+$/))
            throw new Error(`Cannot parse: ${current.line}`);
          t.enum.push(current.line);
          next();
        }
      }
    } else {
      t.$ref = words[0];
      next();
    }
    return type;
  }

  function readProperty() {
    const match = current.line.match(/^(optional)?\s*(.*)\s+([a-zA-Z0-9_]+)$/);
    const prop = {
      optional: !!match[1],
      name: match[3],
    };
    let t = prop;
    const words = match[2].split(' ').filter(s => !!s);
    while (words[0] === 'array' && words[1] === 'of') {
      t.type = 'array';
      const items = {};
      t.items = items;
      t = items;
      words.shift();
      words.shift();
    }
    if (words.length !== 1)
      throw new Error(`Cannot parse: ${current.line}`);
    if (['string', 'boolean', 'integer', 'number'].includes(words[0]))
      t.type = words[0];
    else
      t.$ref = words[0];
    next();
    return prop;
  }

  next();
  return { domains: readDomains() };
}

module.exports = {generateChromiunProtocol, generateFirefoxProtocol, generateWebKitProtocol, generateInternalProtocol};
